# MeowDeck — Game Design & Technical Specification

> **Version:** 1.0 (Development Blueprint)  
> **Status:** Proposed specification — not an implementation report  
> **Genre:** Single-player, turn-based, 2D pixel-art card game  
> **Platform:** Desktop Web / Mobile Web / PWA-capable  
> **Language:** ไทย (TH) / English (EN)  
> **First AI opponent:** Mochi — แมวส้มผู้เล่นไพ่  
> **Core deck:** ไพ่สากล 52 ใบ ไม่รวม Joker  
> **Initial release:** Crazy Eights vs AI  
> **Future games:** Blackjack, Gin Rummy, Five-Card Draw Poker

---

## 1. Executive Summary

**MeowDeck** เป็นเกมไพ่ Pixel Art แบบเล่นคนเดียว แข่งขันกับคู่ต่อสู้ AI ที่เป็นแมว นำโดย **Mochi** แมวส้มลายเสือสวมเสื้อกั๊กสีเขียว ผู้เล่นจะเห็นปฏิกิริยาและแอนิเมชันของแมวระหว่างจั่วไพ่ ลงไพ่ คิด ชนะ หรือแพ้ เพื่อให้รู้สึกเหมือนนั่งเล่นไพ่กับตัวละครจริง

เวอร์ชันแรก (MVP) พัฒนาเกม **Crazy Eights** ให้สมบูรณ์ก่อน โดยออกแบบ **Card Engine**, **Rules Engine**, **AI Adapter**, **Character Animation System** และ **UI Components** แบบแยกส่วน เพื่อขยายเป็นเกมไพ่อื่นภายหลังโดยไม่ต้องเขียนระบบฐานใหม่ซ้ำ

### 1.1 Product Pillars

1. **Simple to start, satisfying to master:** เข้าใจกติกาได้เร็ว แต่ระดับ AI สูงขึ้นต้องใช้การวางแผน
2. **A living AI opponent:** Mochi มีอารมณ์ ท่าทาง และเสียงตอบสนองต่อเกม โดยไม่ใช้การแสดงอารมณ์เพื่อเปิดเผยไพ่ลับ
3. **Authentic pixel art:** ภาพสไตล์ 16-bit ทำด้วยพิกเซลจริง ขอบคม สัดส่วนตัวละครคงที่
4. **Fair and offline-first:** AI มองเห็นเฉพาะข้อมูลที่ผู้เล่นคู่แข่งพึงรู้ และเล่นได้โดยไม่ต้องมีเซิร์ฟเวอร์
5. **Modular architecture:** แชร์สำรับไพ่ การจัดการเทิร์น การแสดงผล และการบันทึกข้อมูลระหว่างเกมหลายประเภท

### 1.2 MVP / Non-goals

**MVP ต้องมี:** Crazy Eights 1v1 กับ Mochi, AI 3 ระดับ, ภาพไพ่ 52 ใบ, แอนิเมชันแมว 10 ชุด, เมนู/ตั้งค่า/หน้าผลลัพธ์, บันทึกเกมและสถิติในเครื่อง, รองรับคอมและมือถือ, TH/EN

**ยังไม่ทำใน MVP:** Multiplayer, ระบบล็อกอิน, Cloud Save, ซื้อขายไพ่หรือเงินจริง, Online Matchmaking, ระบบความสนิท, แมวหลายตัว, เกมไพ่อื่นที่ยังไม่เสร็จสมบูรณ์

---

## 2. Branding & World

| รายการ | ข้อกำหนด |
|---|---|
| Game name | **MeowDeck** |
| Tagline | *A Little Cat. A Clever Deck.* |
| Internal project ID | `meowdeck` |
| First character | **Mochi — The Card Master** |
| Visual theme | Retro Pixel Fantasy × Cozy Card Table |
| Tone | ฉลาด ขี้เล่น เป็นมิตร อบอุ่น ไม่ใช้ภาพแบบคาสิโนสมจริง |
| Content | การแข่งขันเพื่อความสนุกและคะแนนในเกม **ไม่ใช้เงินจริง** |

### 2.1 Mochi Character Identity

- แมวส้มลายเสือ (orange tabby) ตัวกลมเล็กน้อย นั่งอยู่ฝั่งตรงข้ามผู้เล่น
- ขนส้ม แก้มและอุ้งเท้าสีครีม จมูกชมพู ตาสีอำพัน หูสามเหลี่ยม
- เสื้อกั๊กผู้แจกไพ่สีเขียว sage green หางส้มลายเสือ
- บุคลิก: ฉลาด ช่างคิด กวนเล็กน้อย และมีปฏิกิริยาเมื่อผู้เล่นโต้ตอบ
- ความสามารถหลัก: มองไพ่ของตัวเอง คิด เลือกลงไพ่ ใช้อุ้งเท้าเขี่ย/จั่วไพ่
- **Character Master เป็นแหล่งอ้างอิงหลัก**: ห้ามเปลี่ยนสี ลายขน สัดส่วน ความหนาของเส้นขอบ และเครื่องแต่งกายระหว่างแต่ละเฟรม

---

## 3. Player Experience / Core Loop

```text
Launch
  ↓
Main Menu
  ↓
Select Game → Crazy Eights
  ↓
Choose AI Difficulty (Easy / Normal / Hard)
  ↓
Deal 7 cards to each player + open discard
  ↓
Player turn ↔ Mochi AI turn
  ↓
Round ends (empty hand / blocked deck)
  ↓
Round result → Next round
  ↓
First to 3 round wins → Match result
  ↓
Rematch / Main Menu
```

หลักการ UX:
- เวลาผู้เล่นทำรายการที่ผิดกติกา ให้แสดงเหตุผลที่เข้าใจง่าย ไม่ทำให้สถานะเกมเปลี่ยน
- AI แสดง thinking animation ระหว่างเลือกไพ่ แต่ต้องไม่ทำให้การตัดสินใจผิดพลาดหรือแก้สถานะซ้ำ
- แอนิเมชันต้องข้ามได้เมื่อผู้เล่นเปิด **Reduced Motion**
- ระบบเกมเป็นผู้กำหนดไพ่และผลการแข่งขัน ส่วน UI/Animation มีหน้าที่สะท้อนสถานะเท่านั้น

---

## 4. Rules — Crazy Eights (MVP)

> กติกานี้เป็น **MeowDeck Ruleset v1** ที่ล็อกไว้เพื่อให้ QA และ AI ทดสอบได้ตรงกัน ทั้งนี้ Crazy Eights มีหลายกติกาย่อยในโลกจริง

### 4.1 Setup

- ใช้ไพ่ 52 ใบ: `A,2,3,4,5,6,7,8,9,10,J,Q,K` × `♠ ♥ ♦ ♣`
- ผู้เล่นสองฝ่าย: Human 1 คน / Mochi AI 1 ตัว
- แจกฝ่ายละ **7 ใบ**
- ไพ่ที่เหลือเป็น **Draw Pile**; เปิด 1 ใบเป็น **Discard Pile**
- ถ้าไพ่เปิดเริ่มต้นเป็น **8** ให้นำกลับกองจั่ว สับใหม่ และเปิดใหม่จนได้ไพ่ที่ไม่ใช่ 8
- รอบแรกผู้เล่นเริ่มก่อน; รอบต่อไปสลับฝ่ายเริ่ม เพื่อความยุติธรรม
- เริ่มต้นแมตช์ด้วยคะแนนชนะรอบ `Player 0 : AI 0`; ฝ่ายแรกที่ชนะ **3 รอบ** ชนะแมตช์

### 4.2 Legal Moves

- ไพ่ที่ลงได้ต้อง **ดอกตรงกัน** หรือ **แต้ม/หน้าไพ่ตรงกัน** กับใบล่าสุดบน Discard Pile
- ไพ่ **8 เป็น Wild Card** ลงได้ทุกเมื่อ และต้องเลือกดอกใหม่จาก `♠ ♥ ♦ ♣`
- หลังลง 8 จะใช้ **activeSuit** ที่ผู้ลงเลือก เป็นดอกปัจจุบันจนกว่าจะมีการลงไพ่ใบอื่น; การเทียบแต้ม 8 ยังคงทำได้
- หากมีไพ่ที่ลงได้ในมือ ให้เลือกลง 1 ใบ (ใน ruleset นี้ **จั่วโดยสมัครใจไม่ได้**)
- หากไม่มีไพ่ที่ลงได้ ต้องจั่ว **1 ใบ**; หากไพ่ที่จั่วลงได้ สามารถเลือกลงทันทีหรือจบเทิร์น; หากลงไม่ได้ เทิร์นจบทันที
- ถ้ากองจั่วหมด ให้เก็บไพ่ใบบนสุดของกองทิ้งไว้ แล้วสับไพ่ทิ้งใบอื่นกลับมาเป็นกองจั่ว
- หากจั่วไม่ได้เพราะไม่มีไพ่สำหรับรีไซเคิล ให้ผู้เล่นผ่านเทิร์น; หากทั้งสองฝ่ายไม่สามารถลงหรือจั่วได้ต่อเนื่องครบ 2 เทิร์น ให้จบรอบแบบ **blocked round**
- ห้าม AI หรือ UI เล่นสอง action ในเทิร์นเดียวโดยไม่ผ่าน state transition ที่ถูกต้อง

### 4.3 Round / Match End

- **Normal win:** ฝ่ายที่ไม่มีไพ่ในมือหลังจากลงไพ่ ชนะรอบทันที
- **Blocked round:** ฝ่ายที่มี **แต้มไพ่ในมือต่ำกว่า** ชนะรอบ; หากเท่ากัน ถือว่าเสมอและไม่มีใครได้แต้มชนะรอบ
- ค่าคะแนนไพ่ที่เหลือในมือ: `8 = 50`, `J/Q/K = 10`, `A = 1`, `2–10 = ตามหน้าไพ่` (ยกเว้น 8)
- Match End: ฝ่ายแรกที่ชนะ 3 รอบ; เสมอไม่เพิ่มจำนวนรอบชนะ
- Result Screen แสดงผู้ชนะรอบ/แมตช์, round score, จำนวนไพ่ค้างมือ, จำนวนเทิร์น, ปุ่ม Next Round/Rematch/Main Menu

### 4.4 Edge Cases ที่ต้องรองรับ

- ไพ่ 8 เป็นใบสุดท้าย → ชนะรอบทันที ไม่ต้องรอ UI เลือกดอกเพิ่ม
- ลง 8 ขณะยังมีไพ่ในมือ → ต้องเปิด Suit Selector และยืนยันดอกก่อน commit action
- กองจั่วมี 0 ใบ แต่กองทิ้งมีมากกว่า 1 ใบ → recycle ได้ โดยห้ามหยิบไพ่ใบบนสุดกลับไป
- กองจั่วและไพ่ทิ้งที่รีไซเคิลได้เป็น 0 → pass / blocked-round logic
- ผู้ใช้กดซ้ำระหว่าง Animation → ห้ามเกิด double-play/double-draw
- Refresh ระหว่างเทิร์น AI → restore แล้วทำต่อได้อย่างปลอดภัย ไม่สั่ง AI ซ้ำ

---

## 5. Game Modes & Future Expansion

| Phase | Mode | Concept | Notes |
|---|---|---|---|
| MVP | Crazy Eights | แข่งทิ้งไพ่กับ Mochi | เกมแรกและระบบอ้างอิง |
| Later | Blackjack | ทำแต้มใกล้ 21 โดยไม่เกิน | ใช้คะแนนเสมือน/ไม่มีเงินจริง; dealer behavior แยกจากแมวคู่แข่ง |
| Later | Gin Rummy | จั่ว/ทิ้งเพื่อจัด meld | Rules/AI แยกเฉพาะเกม |
| Later | Five-Card Draw | จัดชุดไพ่ 5 ใบและเลือกเปลี่ยน | คะแนนเสมือน ไม่ผูกกับการพนันเงินจริง |

เกมใหม่ทุกเกมต้อง implement `GameDefinition` / `RulesAdapter` ของตนเอง ไม่เพิ่ม `if/else` เกมทั้งหมดลงใน Controller กลาง

---

## 6. AI Design

### 6.1 Difficulty Levels

| Level | Behavior | Goal |
|---|---|---|
| Easy | เลือกจาก legal moves ด้วยการสุ่มแบบมีน้ำหนักต่ำ; เลือกดอกไพ่แบบง่าย | ให้ผู้เล่นเรียนรู้กติกา |
| Normal | Heuristic: ลดจำนวนไพ่, จัดสมดุลดอก, รักษาไพ่ 8 เมื่อเหมาะสม | สนุก มีความท้าทาย |
| Hard | Heuristic + ประเมินข้อมูลสาธารณะ + sampled possible hidden cards; จำกัดเวลาประมวลผล | วางแผนดีโดยไม่โกง |

### 6.2 Fair AI Contract

AI รับ `AIOservation` (observation) ที่ประกอบด้วย:

- ไพ่ในมือ AI เอง
- ไพ่ใบบนสุดของกองทิ้งและ `activeSuit`
- จำนวนไพ่ในมือผู้เล่น (ไม่เห็นหน้าไพ่)
- จำนวนไพ่ในกองจั่ว (ไม่เห็นลำดับ/ค่าไพ่)
- ประวัติการลงไพ่และการเลือกดอกที่เปิดเผยแล้ว
- Legal Moves ที่ Engine คำนวณไว้

**ห้ามส่ง** `playerHand` ของมนุษย์, เนื้อหาในกองจั่ว, random seed ที่สร้าง deck, หรือ hidden game state ให้ AI แม้จะเป็นโหมด Hard

### 6.3 AI Lifecycle

1. Engine เข้าสู่สถานะ `ai_thinking`
2. สร้าง Observation แบบ sanitized
3. AI เลือกหนึ่ง action จาก Legal Moves
4. Validate action ซ้ำที่ Rules Engine
5. Engine commit การเปลี่ยนแปลงสถานะเพียงครั้งเดียว
6. UI เล่น `thinking` → `draw_card` / `play_card` ตาม action ที่ยืนยันแล้ว
7. Animation จบ → ส่งต่อเทิร์นผู้เล่น

AI thinking delay เป็นเพียงเรื่องการนำเสนอ ปรับได้จาก Settings; **Logic ต้องไม่ขึ้นอยู่กับความเร็ว Animation**

---

## 7. Art Direction & Card Assets

### 7.1 Pixel Art Visual Standard

- สไตล์ 16-bit inspired, clean pixel clusters, hard edges, ไม่ใช้ blur/antialiasing
- โทนโต๊ะ: deep green / wood / warm neutral; UI ใช้สีไม่รกและอ่านข้อความได้ชัด
- ใช้พิกเซลขนาดคงที่ทั้งตัวแมวและไพ่; ขยายด้วย integer scaling เมื่อเหมาะสม
- แสดงด้วย CSS `image-rendering: pixelated`; อนุญาตให้ UI ข้อความใช้ฟอนต์ที่อ่านชัดแทน Pixel Font หากจำเป็น
- พื้นหลัง Sprite เป็น RGBA Transparent

### 7.2 Playing Card Package

- **52 Card Faces**: `AS, 2S, ..., KS`, `AH...KH`, `AD...KD`, `AC...KC` (เลือกลำดับที่สอดคล้องกันตลอดระบบ)
- **Card backs**: อย่างน้อย 1 ลาย; รองรับเปลี่ยนลายในอนาคต
- **Base card artwork**: `96 × 144 px` ต่อใบ (อ้างอิง `asset-contract.json`)
- **HD artwork**: `192 × 288 px` ต่อใบ (nearest-neighbor 2×)
- **Aspect ratio**: `2:3`; แผ่น Atlas 8 × 7 ช่อง ขนาด `768 × 1008 px` และ HD Atlas `1536 × 2016 px`
- **Crazy Eights**: ใช้ไพ่ 52 ใบเท่านั้น; `joker_red`, `joker_black` และ `card_back` เป็น assets เสริม ไม่ใช่ไพ่เล่นในสำรับ
- กำหนด card ID ใน Engine เป็น `${rank}${suit}` โดย `rank: A,2...10,J,Q,K`, `suit: S,H,D,C`
- ไพ่จริงควรแสดงแยกจากแมวและแอนิเมชันอุ้งเท้า เพื่อให้ใช้งานได้กับเกมทุกโหมด
- ควบคุมภาพ Ace, J, Q, K ให้อ่านค่าไพ่ได้แม้บนหน้าจอเล็ก

### 7.3 Mochi Color Palette (Starting Reference)

| Element | Color |
|---|---|
| Fur base | `#D87936` |
| Fur highlight | `#EBA45B` |
| Fur shadow | `#A9552B` |
| Cream muzzle/paws | `#F5D4A0` |
| Dark outline | `#49352F` |
| Amber eyes | `#D7B35E` |
| Green vest | `#91A85D` |
| Vest shadow | `#617447` |
| Pink nose | `#D98C87` |

ตั้งเป้า palette รวมประมาณ 16 สี โดยถือ Character Master ที่อนุมัติแล้วเป็น Source of Truth

---

## 8. Mochi Animation — Production Spec

**Per-frame canvas:** `96 × 96 px`  
**Anchor:** `(48, 88)` ใน local frame coordinate  
**Format:** Transparent PNG sprite sheets, one row per animation, adjacent frames  
**Rendering:** Frame-based; allow individual frame timings if needed  
**Layers:** Mochi character, paws, cards, table, VFX แยกกันใน runtime  
**Requirement:** ทุกเฟรมคงรายละเอียดสัดส่วน ขน เสื้อ อุ้งเท้าและหางจาก Character Master
**P0 Asset Contract:** `asset-contract.json` เป็น single source of truth สำหรับ `frameDurationMs`, จำนวนเฟรม, loop และ atlas geometry; `public/assets/meowdeck/mochi/animations.json` เป็น manifest สำหรับ renderer. FPS หากจำเป็นต้องคำนวณจาก `1000 / frameDurationMs` โดยไม่ปัดเป็นจำนวนเต็มเมื่อทำให้เวลาเคลื่อนไหวเปลี่ยนไป. ตัวละครใช้ anchor `(48, 88)` และ origin `(0.5, 88/96)`; animation `thinking` ต้อง loop. ใช้ `actionFrame=3` แบบ zero-based ใน `draw_card` และ `play_card` เพื่อซิงก์ภาพเท่านั้น ไม่สั่งเปลี่ยน game state, และ Reduced Motion ไม่มีผลต่อกติกาหรือผลลัพธ์. กติกา/AI/การ์ดจริงเป็นอิสระจากการเล่น Sprite.

| Clip ID | Frames | Default timing | Playback | Trigger |
|---|---:|---:|---|---|
| `idle` | 4 | 200 ms/frame | loop | สถานะปกติ |
| `blink` | 3 | 100 ms/frame | one-shot/overlay | สุ่มกะพริบในช่วง idle |
| `thinking` | 4 | 180 ms/frame | loop | AI เริ่มตัดสินใจ |
| `draw_card` | 6 | 100 ms/frame | one-shot | AI จั่วไพ่ |
| `play_card` | 6 | 100 ms/frame | one-shot | AI ลงไพ่ |
| `victory` | 6 | 140 ms/frame | one-shot | AI ชนะรอบ/แมตช์ |
| `defeat` | 4 | 200 ms/frame | one-shot | AI แพ้รอบ/แมตช์ |
| `sleep` | 4 | 300 ms/frame | loop | ผู้เล่นไม่โต้ตอบเป็นเวลานาน |
| `pet_reaction` | 4 | 160 ms/frame | one-shot | ผู้เล่นแตะ/คลิกแมว |
| `surprise` | 3 | 120 ms/frame | one-shot | เหตุการณ์พลิกเกมหรือจบตาน่าตกใจ |
| **Total** | **44** | | | |

### 8.1 Animation Ordering / Priority

`victory/defeat` > `draw_card/play_card` > `pet_reaction/surprise` > `thinking` > `sleep` > `idle/blink`

- ท่า one-shot ต้องกลับสู่ state ที่ถูกต้อง ไม่บังคับกลับ idle หากเทิร์นยังเป็น thinking
- เมื่อมี UI interaction ระหว่าง animation ให้ queue/skip ตาม priority อย่างชัดเจน
- ห้าม Animation Event แก้กติกาโดยตรง; Engine สั่ง event แล้ว UI สะท้อนผล
- ใช้ `actionFrame` เช่น frame index 3 (นับจาก 0) เป็นจุดซิงก์ภาพการ์ดจริงกับการเคลื่อนไหวอุ้งเท้า

### 8.2 Master Asset Workflow

1. สร้าง `mochi-master.png` เป็น Character Master (front, 3/4, side, back, expressions)
2. สร้าง `idle` ให้สัดส่วนคงที่ แล้วตรวจการ Loop
3. สร้าง `draw_card` และ `play_card` ซึ่งเป็น interaction สำคัญ
4. สร้างชุดอารมณ์ที่เหลือโดยอ้างอิง Master เดียวกัน
5. ตรวจแต่ละเฟรมและ export sprite sheet ใน Pixel Editor (เช่น Aseprite)
6. ตรวจทุก animation ในเกมจริงที่ 1×, 2×, 3× รวมถึง Mobile

> **หมายเหตุ:** ภาพที่ AI สร้างมักไม่รับประกันขนาดเฟรม/สัดส่วน/ความต่อเนื่องแบบ pixel-perfect ต้องมีขั้นตอน alignment, cleanup และ validation ก่อนใช้จริง

---

## 9. UI/UX — Screens & Layout

### 9.1 Pages / Screens

1. **Splash / Loading:** โลโก้ MeowDeck, loading indicator, ไม่มีการบังคับรอนานโดยไม่จำเป็น
2. **Main Menu:** Play, Continue, Select Game, Statistics, Settings
3. **Game Selection:** Crazy Eights เปิดเล่นได้; เกมอื่นแสดง `Coming Soon` หรือซ่อนไปจนมีเวอร์ชันเล่นจริง
4. **Difficulty Select:** Easy / Normal / Hard พร้อมคำอธิบาย
5. **Gameplay Table:** Mochi, AI hand backs/count, draw/discard piles, active suit, player hand, turn status, controls
6. **Suit Selector:** ปรากฏหลังผู้เล่นลง 8 ที่ยังไม่ใช่ใบสุดท้าย
7. **Pause / Settings:** resume, SFX/music, animation speed, reduced motion, language, restart/quit confirmation
8. **Round Result:** ผู้ชนะรอบ, คะแนน, Next Round
9. **Match Result:** ผู้ชนะเมื่อครบ 3 รอบ, สถิติ, Rematch / Main Menu
10. **Statistics:** games played, match wins, losses, draws (ถ้านับ), win rate, difficulty filter

### 9.2 Desktop Gameplay Hierarchy

```text
┌───────────────────────────────────────────────────┐
│ MeowDeck       Round 2  Player 1 : Mochi 1   ⚙  │
│                                                   │
│             Mochi + Emotion / Speech              │
│                 [AI card backs]                   │
│                                                   │
│             [Draw]   [Discard / Suit]             │
│                                                   │
│             Turn status / Action hint             │
│                                                   │
│                 [Player hand]                     │
│            Draw / Play / Pass (when legal)        │
└───────────────────────────────────────────────────┘
```

### 9.3 Mobile Requirements

- Mobile-first responsive layout; ไม่มีปุ่ม/ไพ่ล้นหน้าจอจนกดไม่ได้
- ไพ่ในมือรองรับ overlap/fan และมีวิธีเลือกที่แม่นยำ เช่น tap-to-select + tap-to-play
- ปุ่มสำคัญมี touch target อย่างน้อยประมาณ `44 × 44 CSS px`
- Mochi สามารถลดขนาดหรือย้ายตำแหน่งได้เมื่อพื้นที่แนวตั้งน้อย
- Safe-area inset สำหรับ PWA/mobile browser และไม่ให้ปุ่มทับ browser controls
- รองรับทั้งเมาส์ คีย์บอร์ด และสัมผัส; มี accessible labels สำหรับไพ่และปุ่ม

### 9.4 Interaction Feedback

- ไพ่ลงได้: มี highlight/outline ที่เข้ากับธีม ไม่ใช้สีเพียงอย่างเดียว
- ไพ่ลงไม่ได้: ไม่ตอบสนองต่อ action พร้อม hint เช่น “ต้องเป็นดอก ♥ หรือแต้ม 7”
- จั่วไม่ได้: แจ้งเหตุผลและเปิดทางให้ pass เมื่อกติกาอนุญาต
- AI thinking: แสดง state ที่ไม่ทำให้ผู้เล่นคิดว่าเว็บค้าง
- Game action: เสียงและ motion ปรับปิดได้; UI ต้องยังเข้าใจได้เมื่อปิดทั้งหมด

---

## 10. Technical Architecture

**Current application platform (P2.5 migration):** Next.js 16 App Router + React 19 + TypeScript; UI-driven 2D card animations (CSS/Canvas/Phaser เป็นทางเลือกตามโครงสร้างจริงที่มี) โดยไม่บังคับใช้เอนจินใหม่หาก React เพียงพอ

### 10.1 High-Level Modules

```text
React UI / Input Controller
          │
          ▼
   Game Session Controller
          │
          ├─ Card Core (deck, shuffle, IDs)
          ├─ Crazy Eights Rules / Reducer
          ├─ AI Adapter (public observation only)
          ├─ Event / Animation Presenter
          ├─ Localization (TH / EN)
          └─ Local Persistence (versioned save)
```

### 10.2 Suggested Folder Structure

```text
src/
  games/
    meowdeck/
      core/
        cards.ts
        deck.ts
        random.ts
        game-types.ts
        game-session.ts
      games/
        crazy-eights/
          rules.ts
          reducer.ts
          scoring.ts
          ai-observation.ts
          ai-easy.ts
          ai-normal.ts
          ai-hard.ts
          selectors.ts
          tests/
        blackjack/             # future
        gin-rummy/             # future
        five-card-draw/        # future
      components/
        GameTable.tsx
        Card.tsx
        CardHand.tsx
        MochiSprite.tsx
        SuitSelector.tsx
        TurnIndicator.tsx
        ResultModal.tsx
      animation/
        mochi-manifest.ts
        animation-controller.ts
      storage/
        save-schema.ts
        local-save.ts
        migrations.ts
      i18n/
        en.ts
        th.ts
      styles/
        meowdeck.css
      tests/
        e2e/
public/
  assets/
    meowdeck/
      cards/
        faces/
        backs/
      cats/
        mochi/
          reference/
            mochi-master.png
          animations/
            mochi-idle.png
            mochi-blink.png
            mochi-thinking.png
            mochi-draw-card.png
            mochi-play-card.png
            mochi-victory.png
            mochi-defeat.png
            mochi-sleep.png
            mochi-pet-reaction.png
            mochi-surprise.png
          portraits/
            mochi-portrait.png
          mochi-animations.json
      audio/
      backgrounds/
```

> โครงสร้างนี้เป็นข้อเสนอ ให้ตรวจ repository จริงก่อนสร้างไฟล์หรือย้ายโมดูล; อย่าสร้างระบบซ้ำกับของเดิมใน NowhereGameHub

### 10.3 Data Types (illustrative)

```ts
type Suit = 'S' | 'H' | 'D' | 'C';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type CardId = `${Rank}${Suit}`;
type Actor = 'human' | 'ai';
type Difficulty = 'easy' | 'normal' | 'hard';

type Phase =
  | 'dealing'
  | 'human_turn'
  | 'ai_thinking'
  | 'resolving_action'
  | 'round_end'
  | 'match_end';

interface Card { id: CardId; rank: Rank; suit: Suit; }

interface AIOservation {
  ownHand: Card[];
  topDiscard: Card;
  activeSuit: Suit;
  opponentHandCount: number;
  drawPileCount: number;
  publicHistory: PublicAction[];
  legalMoves: LegalMove[];
}
```

`PublicAction` และ `LegalMove` ต้องนิยามเป็น discriminated unions ใน implementation จริง เพื่อให้ engine validate ได้ครบทุก action และ AI ได้ข้อมูลเฉพาะที่จำเป็น

### 10.4 State Management Principles

- มี **authoritative state** เพียงจุดเดียวต่อ session
- Logic เกมเป็น pure functions/reducer เท่าที่ทำได้ เพื่อทดสอบโดยไม่ต้อง render React
- ทุก action validate ก่อน state mutation; ป้องกัน double dispatch ด้วย session/turn/action identifiers
- ใช้ RNG ที่เหมาะกับการสับไพ่และ testability (production randomness และ seeded test fixture แยกกัน)
- สามารถ replay test ด้วย test seed ที่ควบคุมได้โดย **ไม่** ส่ง seed production ให้ AI
- UI ประกาศ action, engine ยืนยัน, animation แสดงผล: ไม่เปลี่ยนไพ่เพราะ callback แอนิเมชัน
- หากเกมเพิ่ง restore กลางเทิร์น AI ให้ resume idempotently ตาม phase และ action ID

---

## 11. Save System / Statistics

**MVP ใช้ข้อมูลในเครื่องเท่านั้น** (เช่น versioned `localStorage`; ถ้าข้อมูลใหญ่ในอนาคตค่อยพิจารณา IndexedDB)

```ts
interface MeowDeckSaveV1 {
  schemaVersion: 1;
  gameId: 'crazy-eights';
  sessionId: string;
  savedAt: string;
  sessionState: unknown; // runtime-validated schema in implementation
  settings: {
    language: 'th' | 'en';
    difficulty: 'easy' | 'normal' | 'hard';
    sfxEnabled: boolean;
    musicEnabled: boolean;
    reducedMotion: boolean;
  };
}
```

- บันทึกหลังการเปลี่ยน phase/action สำคัญ
- ไม่บันทึก animation frame เพื่อเป็น source of truth ของ gameplay
- Version save schema และมี migration/fallback เมื่อ save เสียหรือเก่า
- แสดงทางเลือก **Continue** เฉพาะเมื่อมี active session ที่กู้กลับได้
- สถิติควรแยกตาม `gameId` และ `difficulty`; ข้อมูลไม่ควรนับเพิ่มซ้ำเมื่อ refresh หน้าผลลัพธ์
- มีปุ่ม Reset Statistics พร้อมขั้นตอนยืนยัน

---

## 12. Localization & Accessibility

### Localization

- ไทย (`th`) และอังกฤษ (`en`)
- ข้อความทั้งหมดอยู่ใน dictionary; หลีกเลี่ยง hard-coded strings ใน JSX
- ใช้ key เช่น `game.turn.yourTurn`, `game.action.draw`, `game.result.victory`, `cat.mochi.thinking`
- ข้อความตัวละครสั้นและไม่สื่อข้อมูลความน่าจะเป็นที่ AI รู้ไม่ได้

### Accessibility

- รองรับการคลิกและคีย์บอร์ด (focus, Enter/Space, Escape สำหรับ modal)
- Screen reader อ่านหน้าไพ่ เช่น “Seven of Hearts” / “เจ็ดโพแดง”
- แสดง legal/illegal states ด้วยข้อความหรือสัญลักษณ์ ไม่ใช้สีเพียงอย่างเดียว
- รองรับ Reduced Motion, mute SFX/music, ความคมชัดและ contrast ของตัวอักษร
- UI ยังคงเล่นได้โดยปิด animation หรือเมื่อโหลดไฟล์ Sprite บางส่วนไม่สำเร็จ

---

## 13. QA & Acceptance Criteria

### 13.1 Rules & State Tests

- [ ] ไพ่ครบ 52 ใบและไม่ซ้ำหลังสับ/แจก/รีไซเคิล
- [ ] แจกฝ่ายละ 7 ใบ ไพ่ทิ้งตั้งต้นไม่ใช่ 8
- [ ] ลงไพ่ได้เฉพาะดอก/แต้มตรงกันหรือ 8
- [ ] หลังลง 8 ใช้ดอกที่เลือกจนกว่าจะถูกแทนที่ตามกติกา
- [ ] จั่วได้ 1 ใบเมื่อไม่มี legal play; ถ้าไพ่ที่จั่วลงได้ สามารถลงทันทีหรือจบเทิร์น
- [ ] ไม่สามารถจั่วเองขณะมี legal play
- [ ] รีไซเคิลกองทิ้งโดยรักษาไพ่ใบบนสุดไว้
- [ ] blocked round และคะแนนไพ่ถูกต้อง รวมกรณีเสมอ
- [ ] ไพ่ 8 ใบสุดท้ายชนะได้ทันที
- [ ] ชนะครบ 3 รอบแล้วจบแมตช์ถูกต้อง
- [ ] กดซ้ำเร็ว ๆ ไม่ทำให้เกิดการลง/จั่วไพ่ซ้ำ

### 13.2 AI Tests

- [ ] AI ไม่ได้รับข้อมูล hidden state ใน input payload
- [ ] AI ทุกระดับเลือก legal move เสมอ
- [ ] AI ทำงานได้เมื่อ legal move มีเพียง 1 ทางเลือก
- [ ] AI ถูกเรียกเพียงครั้งเดียวต่อ committed turn/action
- [ ] AI Hard มีการควบคุมภาระประมวลผลเพื่อไม่ทำให้ UI ค้าง

### 13.3 UI / Asset Tests

- [ ] ไพ่ 52 ใบถูกผูกกับ card ID ที่ถูกต้อง
- [ ] ทุก Sprite Sheet มี frames ตาม manifest และทุก cell ขนาด 96 × 96 px
- [ ] Mochi ไม่กระตุก/สัดส่วนไม่เปลี่ยนระหว่าง animation
- [ ] `draw_card` และ `play_card` สอดคล้องกับ card VFX
- [ ] UI บนมือถือไม่ล้น ไม่บังปุ่ม และกดไพ่ได้แม่นยำ
- [ ] Refresh แล้ว Continue ได้โดยสถานะไม่ผิด
- [ ] TH/EN และ Reduced Motion ใช้งานได้
- [ ] Offline runtime ทำงานได้หลังติดตั้ง/แคช Asset ตามที่รองรับ

### 13.4 Suggested Quality Gates

- Unit tests: Core Deck, Rules, Scoring, AI observation, reducer transitions
- Component tests: card selection, suit selector, round/match result
- E2E tests: เปิดเกม → เล่นหนึ่งรอบ → refresh → continue → จบแมตช์
- Static checks: TypeScript typecheck, lint, format check
- Asset validation script: ตรวจจำนวนเฟรม, ขนาดภาพ, alpha channel, filenames

---

## 14. Roadmap / Development Phases

| Phase | Scope | Exit condition |
|---|---|---|
| **P1 — Core Engine** | Card types, shuffling, state machine, Crazy Eights rules, tests | กติกาและ edge cases ผ่าน unit tests |
| **P2 — Gameplay UI** | Game table, cards, controls, responsive, menus | เล่นเกมแบบ placeholder assets ได้ครบหนึ่งแมตช์ |
| **P3 — Mochi & AI** | AI 3 ระดับ, Character Master, 44-frame animation pack, VFX | AI fair, animation sync, ไม่มี double actions |
| **P4 — Polish & Persistence** | Local save, statistics, TH/EN, settings, accessibility, SFX | E2E ผ่าน, responsive และ restore ได้ |
| **P5 — New Card Games** | Blackjack, Gin Rummy, Five-Card Draw | ใช้ Core/Asset เดิมและมี rule/AI tests แยกเกม |

### Definition of Done for MVP

เกม Crazy Eights ต้องเล่นจบแมตช์ได้ตั้งแต่เริ่มถึงผลลัพธ์ เล่นได้ทั้ง Desktop/Mobile, AI 3 ระดับไม่โกง, Mochi มี Animation ตามที่กำหนด, state ถูกต้องแม้กดเร็ว/refresh, บันทึกและเล่นต่อได้, และไม่มีปัญหา critical ใน typecheck/unit/E2E

---

## 15. Instructions for Codex / Developers

> **Role:** Senior TypeScript Game Engineer, Card Game Systems Designer, AI Gameplay Engineer, Pixel Art Integration Engineer, UI/UX Developer.

**Mission:** Implement **MeowDeck MVP** using this document as the source of truth. First inspect the actual project architecture and reuse existing routing, state utilities, localization and visual components where sensible. Do not claim implementation before reading code and running checks.

**Working rules:**

1. Start with repository inspection and a brief gap analysis against this spec.
2. Build a pure Crazy Eights Rules Engine with deterministic test fixtures before building animations.
3. Keep player hidden cards and deck order outside AI observation boundaries.
4. Build responsive UI with placeholder assets if art is not yet available; never fabricate paths to nonexistent sprites.
5. Implement Mochi's sprite animation system with manifest-driven frame count/timing and runtime card VFX separation.
6. Add versioned save/resume with idempotent transition handling.
7. Implement automated tests for core rules, AI fairness, animation events and restore behavior.
8. Run format/lint/typecheck/unit/e2e checks available in the repository; report real results and unresolved failures.
9. Do not silently add multiplayer, external database, gambling/payment mechanics, or extra frameworks.
10. Deliver clear changelog, test summary, remaining risks and exact asset requirements.

**Suggested MVP implementation order:** Engine → Rules Tests → AI Observation → UI → Mochi Sprite Integration → Save/Restore → E2E → Polish.

---

## 16. Open Decisions (Not Blocking MVP)

- ตัดสินใจเลือกภาพ Card Back หลักและภาพพื้นหลังโต๊ะที่ผลิตจริง
- ยืนยัน Character Master ของ Mochi ก่อนผลิต 44 เฟรม
- เลือกระบบแสดงภาพแอนิเมชันตามเทคโนโลยีที่ repository ใช้อยู่จริง (React/CSS/Canvas/Phaser)
- ตัดสินใจเพิ่มเติมภายหลังว่าต้องการ Cat Customization, Affinity, Achievements และ Online Leaderboards หรือไม่
- ตรวจชื่อ **MeowDeck** ด้านเครื่องหมายการค้าและโดเมนก่อนเผยแพร่เชิงพาณิชย์

---

## 17. Versioning / Change Log

| Version | Description |
|---|---|
| 1.0 | Initial Game Design & Technical Blueprint: MeowDeck, Crazy Eights MVP, Mochi 44-frame animation specification, AI fairness, UI/UX, architecture and QA |

**End of document.**
