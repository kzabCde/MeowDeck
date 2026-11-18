/** P4.9 reproducible paired-seed evaluation. Numbers describe matches against a
 * single simple baseline, NOT win rates against human players or every opponent. */
import { benchmark } from './benchmark-ai.mjs';

export function wilsonInterval(wins,n,z=1.96) {
 if(!Number.isInteger(n)||n<=0||wins<0||wins>n)throw Error('Invalid win-rate interval');
 const p=wins/n,denom=1+z*z/n;
 const center=(p+z*z/(2*n))/denom;
 const radius=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denom;
 return [Math.max(0,center-radius),Math.min(1,center+radius)].map(v=>Number((v*100).toFixed(2)));
}
export function pairedGap(a,b) {
 if(a.length!==b.length||a.length===0)throw Error('Equal nonempty paired outcomes required');
 const gaps=a.map((v,i)=>v-b[i]), n=gaps.length;
 const mean=gaps.reduce((sum,x)=>sum+x,0)/n;
 const sampleVariance=n>1?gaps.reduce((sum,x)=>sum+(x-mean)**2,0)/(n-1):0;
 const margin=1.96*Math.sqrt(sampleVariance/n);
 const confidence=[mean-margin,mean+margin].map(x=>Number((x*100).toFixed(2)));
 return {
  pointPct:Number((mean*100).toFixed(2)),
  approximate95Pct:confidence,
  assessment:confidence[0]>0?'positive-evidence':confidence[1]<0?'negative-evidence':'inconclusive'
 };
}
function percentile(sorted,p) {
 if(!sorted.length)return 0;
 return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(sorted.length*p)-1))];
}
export function evaluateDifficulties(matches=1000,firstSeed=1) {
 if(!Number.isInteger(matches)||matches<2||matches>10000||!Number.isInteger(firstSeed)||firstSeed<1)throw Error('Invalid seeded evaluation range');
 const outcomes={};const summary={};
 for(const level of ['easy','normal','hard']) {
  const matched=[],decisionMs=[];
  const result=benchmark(level,matches,firstSeed,{
    onDecision:({millis})=>decisionMs.push(millis),
    onMatch:({seed,winner})=>{if(seed!==firstSeed+matched.length)throw Error('Unpaired seed order');matched.push(winner==='ai'?1:0);}
  });
  outcomes[level]=matched;
  decisionMs.sort((a,b)=>a-b);
  summary[level]={
   matches:result.matches,wins:result.wins,losses:result.losses,draws:result.draws,
   winRatePct:result.winRate,wilson95Pct:wilsonInterval(result.wins,result.matches),
   decisions:result.decisions,avgDecisionMs:result.meanMsPerDecision,
   p95DecisionMs:Number(percentile(decisionMs,.95).toFixed(3)),
   maxDecisionMs:result.maxMsPerDecision
  };
 }
 return {
  method:'Identical deterministic shuffled seeds; policy vs same simple non-eight-first legal baseline; no hidden-card information',
  seeds:`${firstSeed}..${firstSeed+matches-1}`,
  summary,
  pairedGaps:{
   normalMinusEasy:pairedGap(outcomes.normal,outcomes.easy),
   hardMinusNormal:pairedGap(outcomes.hard,outcomes.normal),
   hardMinusEasy:pairedGap(outcomes.hard,outcomes.easy)
  },
  caution:'Statistical intervals are approximate; gameplay difficulty also requires actual user testing.'
 };
}
if(import.meta.url===new URL(`file://${process.argv[1]}`).href){
 const count=Number(process.argv[2])||1000;
 console.log(JSON.stringify(evaluateDifficulties(count),null,2));
}
