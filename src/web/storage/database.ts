import type { SavedMatchV1 } from './save-schema.js';
import { validateSavedMatch } from './save-schema.js';
import type { MatchRecord } from '../statistics/statistics-service.js';

const DB_NAME='meowdeck-local-v1';
const DB_VERSION=1;
const LEASE_MS=14_000;
const LIVE_LOCK_NAME='meowdeck:active-match:v1';
export type SaveErrorKind='unavailable'|'conflict'|'invalid'|'quota'|'transaction';
export class SaveError extends Error{constructor(readonly kind:SaveErrorKind,message:string=kind){super(message);this.name='SaveError';}}
export interface StoredActive {readonly key:'active';readonly save:SavedMatchV1;readonly owner:string;readonly leaseUntil:number;}
export interface LoadedMatch {readonly save:SavedMatchV1|null;readonly conflict:boolean;readonly invalid:boolean;readonly reason?:string;}
function request<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function done(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction error'));});}
function toSaveError(e:unknown):SaveError {
  if(e instanceof SaveError)return e;
  return new SaveError(e instanceof DOMException&&e.name==='QuotaExceededError'?'quota':'transaction',e instanceof Error?e.message:String(e));
}
export async function openDatabase():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')throw new SaveError('unavailable','IndexedDB unavailable');
  return new Promise((resolve,reject)=>{
    let req:IDBOpenDBRequest;
    try{req=indexedDB.open(DB_NAME,DB_VERSION);}catch(e){reject(toSaveError(e));return;}
    req.onupgradeneeded=()=>{const db=req.result;
      if(!db.objectStoreNames.contains('active'))db.createObjectStore('active',{keyPath:'key'});
      if(!db.objectStoreNames.contains('matches'))db.createObjectStore('matches',{keyPath:'matchId'});
    };
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
    req.onerror=()=>reject(toSaveError(req.error));req.onblocked=()=>reject(new SaveError('unavailable','Storage upgrade blocked by another tab'));
  });
}
/** All read-modify-write steps happen inside ONE IndexedDB transaction; browser tabs cannot silently overwrite. */
export class LocalGameRepository {
  private heldLiveLock=false;
  private pendingLiveLock:Promise<boolean>|null=null;
  private unlockLiveLock:(()=>void)|null=null;
  private closed=false;
  private constructor(readonly db:IDBDatabase,readonly owner:string){}
  static async create(owner:string){return new LocalGameRepository(await openDatabase(),owner);}
  /**
   * Browser Web Locks are released automatically when a tab closes, even if
   * IndexedDB's 14-second crash-recovery lease is still in the future.
   * A held lock proves a different live tab has not claimed this match.
   * Browsers without Web Locks keep the conservative TTL/explicit takeover.
   */
  private async holdLiveLock():Promise<boolean|null>{
    if(typeof navigator==='undefined'||!navigator.locks?.request)return null;
    if(this.heldLiveLock)return true;
    if(this.pendingLiveLock)return this.pendingLiveLock;
    let settle!: (acquired:boolean)=>void;
    const pending=new Promise<boolean>(resolve=>{settle=resolve;});
    this.pendingLiveLock=pending;
    void navigator.locks.request(LIVE_LOCK_NAME,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock||this.closed){settle(false);return;}
      this.heldLiveLock=true;settle(true);
      await new Promise<void>(resolve=>{this.unlockLiveLock=resolve;});
      this.heldLiveLock=false;this.unlockLiveLock=null;
    }).catch(()=>settle(false));
    const acquired=await pending;
    if(!acquired)this.pendingLiveLock=null;
    return acquired;
  }
  private releaseLiveLock(){
    const unlock=this.unlockLiveLock;
    this.unlockLiveLock=null;this.heldLiveLock=false;this.pendingLiveLock=null;
    unlock?.();
  }
  close(){this.closed=true;this.releaseLiveLock();this.db.close();}
  async load():Promise<LoadedMatch>{
    const tx=this.db.transaction('active','readonly');const row=await request(tx.objectStore('active').get('active')) as StoredActive|undefined;
    await done(tx);
    if(!row)return {save:null,conflict:false,invalid:false};
    const validation=validateSavedMatch(row.save);
    if(!validation.ok)return {save:null,conflict:false,invalid:true,reason:validation.reason};
    return {save:validation.save,conflict:row.owner!==this.owner&&row.leaseUntil>Date.now(),invalid:false};
  }
  async claim(force=false):Promise<SavedMatchV1|null>{
    // A closed tab releases its Web Lock immediately. Do not mistake the
    // remaining IndexedDB lease for proof that the old tab is still open.
    const liveLock=await this.holdLiveLock();
    const tx=this.db.transaction('active','readwrite');const finished=done(tx);
    try{const store=tx.objectStore('active'),row=await request(store.get('active')) as StoredActive|undefined;
      if(!row){await finished;this.releaseLiveLock();return null;}
      const validation=validateSavedMatch(row.save);
      if(!validation.ok)throw new SaveError('invalid',validation.reason);
      if(!force&&row.owner!==this.owner&&row.leaseUntil>Date.now()&&liveLock!==true)throw new SaveError('conflict','Match is currently open in another tab');
      store.put({...row,owner:this.owner,leaseUntil:Date.now()+LEASE_MS});await finished;return validation.save;
    }catch(e){try{tx.abort();}catch{/* completed transaction */}void finished.catch(()=>{});this.releaseLiveLock();throw toSaveError(e);}
  }
  async renew():Promise<boolean>{
    const tx=this.db.transaction('active','readwrite');const finished=done(tx);
    try{const store=tx.objectStore('active'),row=await request(store.get('active')) as StoredActive|undefined;
      if(!row||row.owner!==this.owner){await finished;this.releaseLiveLock();return false;}
      store.put({...row,leaseUntil:Date.now()+LEASE_MS});await finished;return true;
    }catch(e){try{tx.abort();}catch{/* completed transaction */}void finished.catch(()=>{});throw toSaveError(e);}
  }
  async release():Promise<void>{
    const tx=this.db.transaction('active','readwrite');const finished=done(tx);
    try{const store=tx.objectStore('active'),row=await request(store.get('active')) as StoredActive|undefined;
      if(row&&row.owner===this.owner)store.put({...row,leaseUntil:0});await finished;this.releaseLiveLock();
    }catch(e){try{tx.abort();}catch{/* completed transaction */}void finished.catch(()=>{});throw toSaveError(e);}
  }
  /** Atomic compare-and-swap by revision; completion and unique record share one transaction. */
  async commit(save:SavedMatchV1,record?:MatchRecord,replace=false):Promise<SavedMatchV1>{
    // Hold a cross-tab liveness sentinel while a match is being saved.
    // The transactional owner/revision check remains the actual write guard.
    await this.holdLiveLock();
    const tx=this.db.transaction(['active','matches'],'readwrite');const finished=done(tx);
    try{const store=tx.objectStore('active'),previous=await request(store.get('active')) as StoredActive|undefined;
      if(previous&&!replace){
        if(previous.owner!==this.owner&&previous.leaseUntil>Date.now())throw new SaveError('conflict');
        if(previous.save.sessionId!==save.sessionId||previous.save.revision!==save.revision)throw new SaveError('conflict','Stale revision');
      }
      if(replace&&previous&&previous.owner!==this.owner&&previous.leaseUntil>Date.now())throw new SaveError('conflict');
      const updated={...save,revision:previous&&!replace?previous.save.revision+1:1,savedAt:new Date().toISOString()};
      if(record){
        // A stable match ID is the unique primary key; repeat processing cannot increase counts.
        const existing=await request(tx.objectStore('matches').get(record.matchId)) as MatchRecord|undefined;
        if(!existing)tx.objectStore('matches').add(record);
        store.delete('active');
      }else{
        const valid=validateSavedMatch(updated);if(!valid.ok)throw new SaveError('invalid',valid.reason);
        store.put({key:'active',save:updated,owner:this.owner,leaseUntil:Date.now()+LEASE_MS});
      }
      await finished;if(record)this.releaseLiveLock();return updated;
    }catch(e){try{tx.abort();}catch{/* completed transaction */}void finished.catch(()=>{});if(e instanceof SaveError&&e.kind==='conflict')this.releaseLiveLock();throw toSaveError(e);}
  }
  async discard():Promise<void>{
    const tx=this.db.transaction('active','readwrite');const finished=done(tx);
    try{const store=tx.objectStore('active'),row=await request(store.get('active')) as StoredActive|undefined;
      if(row&&row.owner!==this.owner&&row.leaseUntil>Date.now())throw new SaveError('conflict');
      store.delete('active');await finished;this.releaseLiveLock();
    }catch(e){try{tx.abort();}catch{/* completed transaction */}void finished.catch(()=>{});throw toSaveError(e);}
  }
  async records():Promise<MatchRecord[]>{const tx=this.db.transaction('matches','readonly');const r=await request(tx.objectStore('matches').getAll()) as MatchRecord[];await done(tx);return r;}
  async resetStatistics():Promise<void>{const tx=this.db.transaction('matches','readwrite');tx.objectStore('matches').clear();await done(tx);}
}
