import type { Player, Team } from '../types/index.ts';
import type { PitchType, Position, Hand } from '../types/enums.ts';

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'firstName' | 'lastName' | 'number' | 'position' | 'bats' | 'throws'>): Player {
  return {
    age: 28,
    batting: { contact_L: 50, contact_R: 50, power_L: 50, power_R: 50, eye: 50, avoid_k: 50, gap_power: 50, speed: 50, steal: 30, bunt: 30, clutch: 50 },
    pitching: { stuff: 40, movement: 40, control: 40, stamina: 40, velocity: 88, hold_runners: 40, groundball_pct: 50, repertoire: ['fastball'] as PitchType[] },
    fielding: [{ position: overrides.position, range: 50, arm_strength: 50, arm_accuracy: 50, turn_dp: 50, error_rate: 50 }],
    mental: { intelligence: 50, work_ethic: 50, durability: 50, consistency: 50, composure: 50, leadership: 50 },
    state: { fatigue: 0, morale: 75, pitchCount: 0, isInjured: false },
    ...overrides,
  };
}

// Helper to make a pitcher with less typing
function mp(id: string, first: string, last: string, num: number, bats: Hand, throws_: Hand, pitching: { stuff: number; movement: number; control: number; stamina: number; velocity: number; hold_runners: number; groundball_pct: number; repertoire: PitchType[] }, age = 28): Player {
  return makePlayer({
    id, firstName: first, lastName: last, number: num, position: 'P' as Position, bats, throws: throws_, age,
    batting: { contact_L: 15, contact_R: 15, power_L: 10, power_R: 10, eye: 15, avoid_k: 12, gap_power: 10, speed: 25, steal: 5, bunt: 20, clutch: 25 },
    pitching,
    fielding: [{ position: 'P' as Position, range: 40, arm_strength: 60, arm_accuracy: 50, turn_dp: 35, error_rate: 45 }],
  });
}

// Helper to make a position player
function mb(id: string, first: string, last: string, num: number, pos: Position, bats: Hand, throws_: Hand,
  bat: { cL: number; cR: number; pL: number; pR: number; eye: number; ak: number; gap: number; spd: number; stl: number; bnt: number; clt: number },
  fld: { rng: number; arm: number; acc: number; dp: number; err: number }, age = 28): Player {
  return makePlayer({
    id, firstName: first, lastName: last, number: num, position: pos, bats, throws: throws_, age,
    batting: { contact_L: bat.cL, contact_R: bat.cR, power_L: bat.pL, power_R: bat.pR, eye: bat.eye, avoid_k: bat.ak, gap_power: bat.gap, speed: bat.spd, steal: bat.stl, bunt: bat.bnt, clutch: bat.clt },
    fielding: [{ position: pos, range: fld.rng, arm_strength: fld.arm, arm_accuracy: fld.acc, turn_dp: fld.dp, error_rate: fld.err }],
  });
}

function makeTeam(id: string, name: string, abbr: string, city: string, c1: string, c2: string, players: Player[]): Team {
  const pos = players.filter(p => p.position !== 'P');
  const pitchers = players.filter(p => p.position === 'P');
  const sp1 = pitchers[0];
  // First 5 pitchers form the starting rotation; rest go to bullpen
  const rotation = pitchers.slice(0, 5).map(p => p.id);
  const bullpen = pitchers.slice(5).map(p => p.id);
  // lineup = first 9 position players
  const lineup = pos.slice(0, 9).map(p => ({ playerId: p.id, position: p.position }));
  return { id, name, abbreviation: abbr, city, primaryColor: c1, secondaryColor: c2, roster: { players }, lineup, pitcherId: sp1.id, rotation, bullpen };
}

// ═══════════════════════════════════════════════════════════
// AMERICAN LEAGUE EAST
// ═══════════════════════════════════════════════════════════

// 1. Austin Thunderhawks (existing team — power-hitting, strong rotation)
const thunderhawksPlayers: Player[] = [
  mb('th-cf','Terrence','Washington',8,'CF','R','R',{cL:62,cR:60,pL:48,pR:52,eye:58,ak:55,gap:55,spd:82,stl:78,bnt:50,clt:50},{rng:85,arm:68,acc:70,dp:30,err:12}),
  mb('th-2b','Koji','Tanaka',4,'2B','R','R',{cL:70,cR:72,pL:35,pR:38,eye:68,ak:70,gap:45,spd:72,stl:65,bnt:60,clt:52},{rng:75,arm:55,acc:72,dp:78,err:18}),
  mb('th-ss','Jaylen','Brooks',2,'SS','S','R',{cL:68,cR:65,pL:42,pR:45,eye:62,ak:60,gap:50,spd:78,stl:72,bnt:55,clt:58},{rng:80,arm:70,acc:75,dp:72,err:15}),
  mb('th-dh','Rafael','Guerrero',44,'DH','R','R',{cL:52,cR:58,pL:82,pR:88,eye:48,ak:38,gap:80,spd:28,stl:5,bnt:10,clt:72},{rng:20,arm:40,acc:40,dp:20,err:70}),
  mb('th-rf','Brandon','Mitchell',34,'RF','R','R',{cL:58,cR:65,pL:78,pR:82,eye:52,ak:40,gap:78,spd:45,stl:15,bnt:15,clt:70},{rng:58,arm:78,acc:65,dp:30,err:28}),
  mb('th-lf','Dmitri','Volkov',22,'LF','L','L',{cL:55,cR:68,pL:72,pR:80,eye:55,ak:45,gap:75,spd:55,stl:30,bnt:20,clt:52},{rng:62,arm:58,acc:60,dp:30,err:32}),
  mb('th-3b','Carlos','Mendoza',15,'3B','R','R',{cL:55,cR:62,pL:72,pR:75,eye:48,ak:42,gap:68,spd:42,stl:20,bnt:30,clt:65},{rng:68,arm:72,acc:65,dp:55,err:28}),
  mb('th-1b','Derek','Thompson',28,'1B','L','L',{cL:60,cR:72,pL:68,pR:78,eye:62,ak:55,gap:72,spd:30,stl:10,bnt:15,clt:55},{rng:55,arm:48,acc:60,dp:52,err:30}),
  mb('th-c','Marcus','Rivera',12,'C','R','R',{cL:58,cR:65,pL:55,pR:62,eye:55,ak:52,gap:58,spd:35,stl:15,bnt:25,clt:60},{rng:65,arm:72,acc:68,dp:45,err:25}),
  // Bench
  mb('th-bn1','Sam','Ortega',18,'LF','L','R',{cL:52,cR:60,pL:55,pR:60,eye:50,ak:48,gap:52,spd:60,stl:40,bnt:45,clt:48},{rng:58,arm:52,acc:55,dp:25,err:35}),
  mb('th-bn2','Ty','Fujimoto',6,'2B','R','R',{cL:58,cR:62,pL:30,pR:32,eye:60,ak:62,gap:38,spd:65,stl:55,bnt:55,clt:45},{rng:70,arm:50,acc:65,dp:72,err:22}),
  mb('th-bn3','Greg','Patterson',16,'C','R','R',{cL:48,cR:55,pL:45,pR:50,eye:50,ak:48,gap:45,spd:30,stl:8,bnt:20,clt:55},{rng:60,arm:68,acc:62,dp:40,err:30}),
  mb('th-bn4','Reggie','Dawson',30,'1B','R','R',{cL:50,cR:58,pL:65,pR:70,eye:45,ak:38,gap:62,spd:32,stl:5,bnt:12,clt:58},{rng:50,arm:45,acc:52,dp:48,err:35}),
  // SP
  mp('th-sp1','Jake','Morrison',47,'R','R',{stuff:72,movement:68,control:70,stamina:75,velocity:95,hold_runners:55,groundball_pct:48,repertoire:['fastball','slider','changeup','curveball']},29),
  mp('th-sp2','Nate','Aldridge',35,'R','R',{stuff:65,movement:62,control:68,stamina:72,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['fastball','curveball','changeup']}),
  mp('th-sp3','Eduardo','Vasquez',41,'L','L',{stuff:62,movement:65,control:60,stamina:70,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','slider','changeup']},26),
  mp('th-sp4','Brett','Kessler',50,'R','R',{stuff:58,movement:60,control:62,stamina:68,velocity:92,hold_runners:48,groundball_pct:50,repertoire:['fastball','slider','curveball']},30),
  mp('th-sp5','Ian','Holbrook',29,'R','R',{stuff:55,movement:58,control:65,stamina:65,velocity:90,hold_runners:52,groundball_pct:55,repertoire:['sinker','cutter','changeup']},27),
  // Bullpen
  mp('th-rp1','Tyler','Chen',55,'R','R',{stuff:68,movement:65,control:62,stamina:45,velocity:97,hold_runners:50,groundball_pct:40,repertoire:['fastball','slider']}),
  mp('th-rp2','Oscar','Reyes',62,'L','L',{stuff:62,movement:70,control:58,stamina:50,velocity:92,hold_runners:60,groundball_pct:58,repertoire:['sinker','slider','changeup']}),
  mp('th-rp3','Darius','Jackson',38,'R','R',{stuff:75,movement:72,control:55,stamina:35,velocity:99,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('th-rp4','Kenny','Marsh',60,'R','R',{stuff:58,movement:55,control:60,stamina:48,velocity:94,hold_runners:48,groundball_pct:52,repertoire:['fastball','changeup','slider']}),
  mp('th-rp5','Paul','Lindgren',64,'L','L',{stuff:55,movement:62,control:58,stamina:45,velocity:90,hold_runners:55,groundball_pct:60,repertoire:['sinker','curveball']}),
  mp('th-rp6','Marco','Beltran',57,'R','R',{stuff:60,movement:58,control:55,stamina:42,velocity:95,hold_runners:45,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('th-rp7','Corey','Whitfield',66,'R','R',{stuff:52,movement:55,control:62,stamina:50,velocity:91,hold_runners:50,groundball_pct:55,repertoire:['sinker','cutter','changeup']}),
];

// 2. Pittsburgh Ironclads (existing team — speed & defense)
const ironcladsPlayers: Player[] = [
  mb('ic-cf','Kenji','Nakamura',9,'CF','L','R',{cL:60,cR:70,pL:45,pR:50,eye:62,ak:58,gap:52,spd:85,stl:80,bnt:55,clt:48},{rng:88,arm:65,acc:68,dp:30,err:10}),
  mb('ic-2b','Tommy','Park',3,'2B','L','R',{cL:65,cR:72,pL:32,pR:35,eye:70,ak:72,gap:42,spd:68,stl:58,bnt:65,clt:48},{rng:78,arm:52,acc:75,dp:80,err:15}),
  mb('ic-ss','Devon','Williams',1,'SS','R','R',{cL:72,cR:70,pL:38,pR:42,eye:65,ak:62,gap:48,spd:75,stl:68,bnt:58,clt:55},{rng:82,arm:72,acc:78,dp:75,err:12}),
  mb('ic-1b','Victor','Santos',19,'1B','L','L',{cL:58,cR:70,pL:75,pR:85,eye:58,ak:48,gap:78,spd:28,stl:8,bnt:12,clt:58},{rng:52,arm:50,acc:58,dp:55,err:28}),
  mb('ic-rf','Ethan','Clarke',33,'RF','R','R',{cL:55,cR:62,pL:80,pR:85,eye:50,ak:38,gap:75,spd:42,stl:12,bnt:12,clt:72},{rng:55,arm:80,acc:68,dp:30,err:30}),
  mb('ic-dh','James','O\'Brien',40,'DH','L','R',{cL:50,cR:65,pL:78,pR:82,eye:55,ak:42,gap:76,spd:30,stl:8,bnt:8,clt:65},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('ic-3b','Miguel','Herrera',11,'3B','R','R',{cL:60,cR:68,pL:70,pR:72,eye:52,ak:45,gap:65,spd:38,stl:18,bnt:28,clt:68},{rng:72,arm:75,acc:70,dp:58,err:22}),
  mb('ic-lf','Andre','Johnson',25,'LF','R','R',{cL:60,cR:66,pL:68,pR:75,eye:52,ak:48,gap:70,spd:60,stl:35,bnt:22,clt:55},{rng:65,arm:62,acc:62,dp:30,err:28}),
  mb('ic-c','Austin','Cooper',7,'C','R','R',{cL:55,cR:62,pL:52,pR:58,eye:58,ak:55,gap:55,spd:32,stl:10,bnt:20,clt:62},{rng:70,arm:75,acc:72,dp:48,err:20}),
  // Bench
  mb('ic-bn1','Zach','Rivera',14,'SS','S','R',{cL:55,cR:58,pL:30,pR:32,eye:55,ak:58,gap:35,spd:72,stl:62,bnt:60,clt:45},{rng:75,arm:65,acc:70,dp:68,err:20}),
  mb('ic-bn2','Darren','Walsh',20,'RF','R','R',{cL:50,cR:55,pL:58,pR:62,eye:48,ak:42,gap:55,spd:48,stl:18,bnt:18,clt:52},{rng:52,arm:72,acc:60,dp:25,err:32}),
  mb('ic-bn3','Pete','Guzman',36,'C','R','R',{cL:45,cR:52,pL:48,pR:52,eye:50,ak:50,gap:45,spd:28,stl:5,bnt:18,clt:55},{rng:65,arm:70,acc:65,dp:42,err:25}),
  mb('ic-bn4','Will','Chambers',17,'1B','L','L',{cL:48,cR:58,pL:62,pR:68,eye:50,ak:42,gap:60,spd:30,stl:5,bnt:10,clt:50},{rng:48,arm:45,acc:52,dp:50,err:32}),
  // SP
  mp('ic-sp1','Ryan','Fitzgerald',31,'L','L',{stuff:70,movement:72,control:65,stamina:72,velocity:94,hold_runners:62,groundball_pct:55,repertoire:['fastball','curveball','changeup','sinker']},27),
  mp('ic-sp2','Grant','Holloway',42,'R','R',{stuff:64,movement:66,control:62,stamina:70,velocity:93,hold_runners:50,groundball_pct:50,repertoire:['fastball','slider','changeup']},29),
  mp('ic-sp3','Hector','Salinas',39,'R','R',{stuff:60,movement:62,control:64,stamina:68,velocity:91,hold_runners:55,groundball_pct:56,repertoire:['sinker','curveball','changeup']},31),
  mp('ic-sp4','Drew','Bancroft',46,'L','L',{stuff:56,movement:60,control:60,stamina:66,velocity:90,hold_runners:58,groundball_pct:52,repertoire:['fastball','slider','changeup']},26),
  mp('ic-sp5','Troy','Underwood',53,'R','R',{stuff:54,movement:56,control:62,stamina:64,velocity:89,hold_runners:48,groundball_pct:54,repertoire:['sinker','cutter','curveball']},30),
  // Bullpen
  mp('ic-rp1','Marcus','Stone',52,'R','R',{stuff:65,movement:68,control:65,stamina:48,velocity:96,hold_runners:52,groundball_pct:45,repertoire:['fastball','cutter','slider']}),
  mp('ic-rp2','Luis','Ramirez',48,'L','L',{stuff:60,movement:65,control:62,stamina:50,velocity:91,hold_runners:58,groundball_pct:60,repertoire:['sinker','changeup','curveball']}),
  mp('ic-rp3','Chris','Taylor',45,'R','R',{stuff:72,movement:70,control:60,stamina:32,velocity:100,hold_runners:48,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('ic-rp4','Brent','Kowalski',58,'R','R',{stuff:56,movement:58,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:55,repertoire:['sinker','slider','changeup']}),
  mp('ic-rp5','Jesse','Franco',63,'L','L',{stuff:58,movement:60,control:55,stamina:45,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['fastball','curveball']}),
  mp('ic-rp6','Aaron','Stokes',67,'R','R',{stuff:54,movement:56,control:58,stamina:48,velocity:94,hold_runners:45,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('ic-rp7','Manny','Vega',70,'R','R',{stuff:52,movement:54,control:60,stamina:52,velocity:90,hold_runners:52,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];


// 3. Charlotte Knights — balanced, solid all-around
const charlotteKnightsPlayers: Player[] = [
  mb('ck-cf','Deon','Harper',1,'CF','S','R',{cL:65,cR:68,pL:40,pR:42,eye:60,ak:58,gap:48,spd:80,stl:72,bnt:50,clt:52},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('ck-2b','Ricky','Callahan',6,'2B','R','R',{cL:62,cR:68,pL:35,pR:40,eye:65,ak:65,gap:42,spd:65,stl:50,bnt:55,clt:50},{rng:72,arm:52,acc:70,dp:75,err:18}),
  mb('ck-ss','Mateo','Reyes',10,'SS','R','R',{cL:60,cR:65,pL:45,pR:50,eye:58,ak:55,gap:50,spd:72,stl:60,bnt:48,clt:55},{rng:78,arm:68,acc:72,dp:70,err:16}),
  mb('ck-1b','Chase','Whitmore',24,'1B','L','L',{cL:55,cR:70,pL:72,pR:78,eye:58,ak:48,gap:72,spd:32,stl:8,bnt:12,clt:60},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('ck-rf','Trent','Blackwell',22,'RF','R','R',{cL:58,cR:64,pL:65,pR:72,eye:52,ak:45,gap:68,spd:50,stl:20,bnt:18,clt:62},{rng:60,arm:75,acc:65,dp:28,err:25}),
  mb('ck-dh','Frank','Delgado',35,'DH','R','R',{cL:55,cR:60,pL:70,pR:76,eye:52,ak:42,gap:72,spd:30,stl:5,bnt:10,clt:65},{rng:20,arm:38,acc:38,dp:20,err:70}),
  mb('ck-3b','Leo','Caruso',15,'3B','R','R',{cL:58,cR:62,pL:62,pR:68,eye:55,ak:50,gap:62,spd:42,stl:18,bnt:28,clt:58},{rng:68,arm:70,acc:65,dp:55,err:25}),
  mb('ck-lf','Darius','Freeman',7,'LF','L','R',{cL:52,cR:64,pL:60,pR:68,eye:55,ak:50,gap:62,spd:62,stl:42,bnt:25,clt:52},{rng:62,arm:55,acc:58,dp:28,err:30}),
  mb('ck-c','Troy','Benoit',19,'C','R','R',{cL:52,cR:58,pL:50,pR:55,eye:55,ak:52,gap:50,spd:32,stl:8,bnt:22,clt:58},{rng:68,arm:72,acc:68,dp:45,err:22}),
  mb('ck-bn1','Noel','Saunders',13,'CF','L','R',{cL:50,cR:58,pL:35,pR:38,eye:52,ak:55,gap:40,spd:75,stl:65,bnt:50,clt:45},{rng:78,arm:58,acc:60,dp:25,err:18}),
  mb('ck-bn2','Bryce','Kendall',17,'SS','R','R',{cL:55,cR:60,pL:32,pR:35,eye:55,ak:58,gap:38,spd:68,stl:52,bnt:52,clt:48},{rng:72,arm:62,acc:68,dp:68,err:20}),
  mb('ck-bn3','Danny','Lowe',32,'C','R','R',{cL:45,cR:52,pL:48,pR:52,eye:48,ak:48,gap:45,spd:28,stl:5,bnt:18,clt:52},{rng:62,arm:68,acc:62,dp:40,err:28}),
  mb('ck-bn4','Jose','Padilla',40,'1B','L','L',{cL:48,cR:55,pL:60,pR:65,eye:48,ak:42,gap:58,spd:30,stl:5,bnt:10,clt:50},{rng:50,arm:45,acc:52,dp:48,err:32}),
  mp('ck-sp1','Garrett','Sullivan',33,'R','R',{stuff:66,movement:64,control:68,stamina:72,velocity:93,hold_runners:52,groundball_pct:50,repertoire:['fastball','slider','changeup','curveball']},28),
  mp('ck-sp2','Wade','Thornton',41,'L','L',{stuff:62,movement:60,control:65,stamina:70,velocity:91,hold_runners:55,groundball_pct:54,repertoire:['fastball','curveball','changeup']},30),
  mp('ck-sp3','Ronnie','Estrada',49,'R','R',{stuff:60,movement:62,control:60,stamina:68,velocity:92,hold_runners:48,groundball_pct:52,repertoire:['sinker','slider','changeup']},27),
  mp('ck-sp4','Dale','Perkins',52,'R','R',{stuff:56,movement:58,control:62,stamina:66,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['fastball','cutter','curveball']},31),
  mp('ck-sp5','Quincy','Yates',37,'L','L',{stuff:54,movement:56,control:60,stamina:64,velocity:89,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup','curveball']},29),
  mp('ck-rp1','Vince','Garrett',56,'R','R',{stuff:66,movement:62,control:60,stamina:42,velocity:96,hold_runners:48,groundball_pct:40,repertoire:['fastball','slider']}),
  mp('ck-rp2','Pete','Harmon',60,'L','L',{stuff:58,movement:62,control:58,stamina:48,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('ck-rp3','Clay','Barton',45,'R','R',{stuff:70,movement:68,control:58,stamina:32,velocity:98,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('ck-rp4','Joel','Hensley',63,'R','R',{stuff:56,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']}),
  mp('ck-rp5','Sean','Kimball',66,'L','L',{stuff:54,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('ck-rp6','Alex','Rowan',70,'R','R',{stuff:52,movement:55,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:50,repertoire:['fastball','slider']}),
  mp('ck-rp7','Tim','Brock',73,'R','R',{stuff:50,movement:52,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:54,repertoire:['sinker','cutter','changeup']}),
];

// 4. Norfolk Tides — pitching-first team, elite rotation
const norfolkTidesPlayers: Player[] = [
  mb('nt-cf','Shane','Crawford',8,'CF','L','R',{cL:55,cR:65,pL:38,pR:42,eye:58,ak:55,gap:45,spd:78,stl:68,bnt:48,clt:50},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('nt-2b','Allen','Craft',4,'2B','R','R',{cL:58,cR:62,pL:30,pR:35,eye:62,ak:65,gap:38,spd:62,stl:48,bnt:55,clt:48},{rng:75,arm:52,acc:72,dp:78,err:16}),
  mb('nt-ss','Julio','Santana',2,'SS','R','R',{cL:60,cR:62,pL:35,pR:40,eye:58,ak:55,gap:42,spd:70,stl:58,bnt:50,clt:52},{rng:80,arm:70,acc:75,dp:72,err:14}),
  mb('nt-1b','Kyle','Jorgensen',23,'1B','L','L',{cL:52,cR:62,pL:62,pR:70,eye:55,ak:48,gap:65,spd:30,stl:8,bnt:12,clt:55},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('nt-rf','Craig','Mullins',21,'RF','R','R',{cL:55,cR:60,pL:58,pR:65,eye:50,ak:45,gap:60,spd:48,stl:18,bnt:18,clt:58},{rng:58,arm:72,acc:62,dp:28,err:28}),
  mb('nt-dh','Pete','Gallagher',30,'DH','R','R',{cL:50,cR:58,pL:65,pR:72,eye:50,ak:40,gap:68,spd:28,stl:5,bnt:8,clt:62},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('nt-3b','Nick','Brennan',14,'3B','R','R',{cL:55,cR:58,pL:55,pR:60,eye:52,ak:50,gap:55,spd:40,stl:15,bnt:30,clt:55},{rng:70,arm:72,acc:68,dp:58,err:22}),
  mb('nt-lf','Ronnie','Fields',17,'LF','L','R',{cL:50,cR:60,pL:52,pR:58,eye:52,ak:48,gap:55,spd:58,stl:38,bnt:25,clt:48},{rng:60,arm:55,acc:58,dp:28,err:30}),
  mb('nt-c','Adam','Pratt',12,'C','R','R',{cL:50,cR:55,pL:45,pR:50,eye:55,ak:55,gap:48,spd:30,stl:8,bnt:22,clt:60},{rng:72,arm:75,acc:72,dp:48,err:18}),
  mb('nt-bn1','Eli','Dawkins',26,'CF','R','R',{cL:48,cR:55,pL:32,pR:35,eye:50,ak:52,gap:38,spd:72,stl:60,bnt:48,clt:45},{rng:78,arm:58,acc:60,dp:25,err:18}),
  mb('nt-bn2','Omar','Luna',11,'SS','R','R',{cL:52,cR:58,pL:28,pR:32,eye:52,ak:55,gap:35,spd:65,stl:50,bnt:52,clt:48},{rng:72,arm:62,acc:68,dp:68,err:20}),
  mb('nt-bn3','Cal','Bishop',36,'C','R','R',{cL:42,cR:50,pL:42,pR:48,eye:48,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:65,arm:70,acc:65,dp:42,err:25}),
  mb('nt-bn4','Wade','Dunlap',39,'1B','L','L',{cL:45,cR:52,pL:55,pR:62,eye:48,ak:42,gap:55,spd:28,stl:5,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:32}),
  mp('nt-sp1','Calvin','Mercer',33,'R','R',{stuff:78,movement:75,control:72,stamina:78,velocity:96,hold_runners:58,groundball_pct:45,repertoire:['fastball','slider','curveball','changeup']},27),
  mp('nt-sp2','Leo','Whitman',41,'L','L',{stuff:72,movement:70,control:70,stamina:74,velocity:93,hold_runners:60,groundball_pct:55,repertoire:['fastball','changeup','curveball','sinker']},29),
  mp('nt-sp3','Dante','Rosario',49,'R','R',{stuff:68,movement:68,control:66,stamina:72,velocity:94,hold_runners:52,groundball_pct:48,repertoire:['fastball','slider','changeup']},26),
  mp('nt-sp4','Blake','Sutherland',52,'R','R',{stuff:65,movement:62,control:68,stamina:70,velocity:92,hold_runners:55,groundball_pct:52,repertoire:['sinker','cutter','changeup','curveball']},30),
  mp('nt-sp5','Cody','Nolan',37,'L','L',{stuff:62,movement:60,control:65,stamina:68,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['fastball','curveball','changeup']},28),
  mp('nt-rp1','Derrick','Haines',56,'R','R',{stuff:72,movement:70,control:65,stamina:40,velocity:98,hold_runners:50,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('nt-rp2','Felix','Almonte',60,'L','L',{stuff:65,movement:68,control:62,stamina:48,velocity:92,hold_runners:58,groundball_pct:60,repertoire:['sinker','changeup','curveball']}),
  mp('nt-rp3','Ray','Stratton',45,'R','R',{stuff:68,movement:65,control:58,stamina:35,velocity:97,hold_runners:45,groundball_pct:40,repertoire:['fastball','slider']}),
  mp('nt-rp4','Scott','Engle',63,'R','R',{stuff:60,movement:58,control:62,stamina:50,velocity:94,hold_runners:50,groundball_pct:50,repertoire:['fastball','cutter','changeup']}),
  mp('nt-rp5','Ruben','Cordova',66,'L','L',{stuff:58,movement:62,control:55,stamina:45,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('nt-rp6','Trey','Ingram',70,'R','R',{stuff:55,movement:55,control:58,stamina:48,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('nt-rp7','Doug','Frey',73,'R','R',{stuff:52,movement:55,control:62,stamina:52,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// 5. Hartford Colonials — contact/discipline team, walks a lot
const hartfordColonialsPlayers: Player[] = [
  mb('hc-cf','Aaron','Nguyen',1,'CF','L','R',{cL:58,cR:68,pL:35,pR:40,eye:70,ak:68,gap:42,spd:78,stl:65,bnt:52,clt:50},{rng:80,arm:60,acc:62,dp:28,err:15}),
  mb('hc-2b','Dennis','Kramer',4,'2B','R','R',{cL:68,cR:72,pL:28,pR:32,eye:72,ak:72,gap:35,spd:60,stl:42,bnt:62,clt:50},{rng:72,arm:50,acc:70,dp:76,err:18}),
  mb('hc-ss','Evan','Schuster',7,'SS','S','R',{cL:65,cR:62,pL:32,pR:35,eye:68,ak:65,gap:38,spd:72,stl:58,bnt:55,clt:55},{rng:78,arm:68,acc:72,dp:72,err:16}),
  mb('hc-1b','Gordon','Maxwell',22,'1B','L','L',{cL:55,cR:68,pL:65,pR:72,eye:68,ak:55,gap:68,spd:28,stl:5,bnt:12,clt:58},{rng:52,arm:48,acc:58,dp:52,err:28}),
  mb('hc-rf','Len','Prescott',18,'RF','R','R',{cL:60,cR:65,pL:55,pR:62,eye:65,ak:58,gap:58,spd:48,stl:20,bnt:20,clt:60},{rng:58,arm:70,acc:62,dp:28,err:28}),
  mb('hc-dh','Mack','Townsend',33,'DH','L','R',{cL:52,cR:65,pL:62,pR:68,eye:70,ak:55,gap:65,spd:28,stl:5,bnt:8,clt:62},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('hc-3b','Dustin','Avery',12,'3B','R','R',{cL:62,cR:65,pL:52,pR:58,eye:62,ak:58,gap:55,spd:42,stl:18,bnt:32,clt:55},{rng:68,arm:68,acc:65,dp:55,err:24}),
  mb('hc-lf','Ian','Robles',25,'LF','L','R',{cL:52,cR:62,pL:50,pR:55,eye:62,ak:58,gap:52,spd:60,stl:42,bnt:28,clt:50},{rng:62,arm:55,acc:58,dp:28,err:30}),
  mb('hc-c','Tony','Marchetti',16,'C','R','R',{cL:55,cR:60,pL:45,pR:50,eye:60,ak:58,gap:48,spd:30,stl:8,bnt:22,clt:58},{rng:68,arm:70,acc:68,dp:45,err:22}),
  mb('hc-bn1','Gil','Odom',9,'CF','R','R',{cL:48,cR:55,pL:28,pR:32,eye:55,ak:55,gap:35,spd:72,stl:60,bnt:50,clt:45},{rng:76,arm:58,acc:60,dp:25,err:18}),
  mb('hc-bn2','Simon','Voss',14,'2B','L','R',{cL:52,cR:58,pL:25,pR:28,eye:62,ak:62,gap:30,spd:60,stl:45,bnt:58,clt:48},{rng:70,arm:48,acc:65,dp:72,err:20}),
  mb('hc-bn3','Jerry','Stahl',28,'C','R','R',{cL:42,cR:50,pL:42,pR:48,eye:52,ak:50,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:62,arm:68,acc:62,dp:40,err:28}),
  mb('hc-bn4','Pat','Duffy',38,'1B','L','L',{cL:45,cR:55,pL:55,pR:60,eye:58,ak:48,gap:52,spd:28,stl:5,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:32}),
  mp('hc-sp1','Warren','Hobbs',34,'R','R',{stuff:65,movement:62,control:70,stamina:74,velocity:93,hold_runners:55,groundball_pct:52,repertoire:['fastball','slider','changeup','curveball']},29),
  mp('hc-sp2','Phil','Dunbar',41,'L','L',{stuff:62,movement:65,control:66,stamina:70,velocity:91,hold_runners:58,groundball_pct:56,repertoire:['sinker','curveball','changeup']},28),
  mp('hc-sp3','Neil','Corcoran',49,'R','R',{stuff:58,movement:60,control:64,stamina:68,velocity:92,hold_runners:50,groundball_pct:50,repertoire:['fastball','slider','changeup']},30),
  mp('hc-sp4','Ted','Archer',52,'R','R',{stuff:56,movement:58,control:62,stamina:66,velocity:90,hold_runners:52,groundball_pct:54,repertoire:['sinker','cutter','changeup']},27),
  mp('hc-sp5','Liam','Crosby',37,'L','L',{stuff:54,movement:56,control:60,stamina:64,velocity:89,hold_runners:55,groundball_pct:58,repertoire:['fastball','changeup','curveball']},31),
  mp('hc-rp1','Rex','Moreno',56,'R','R',{stuff:65,movement:62,control:60,stamina:42,velocity:96,hold_runners:48,groundball_pct:40,repertoire:['fastball','slider']}),
  mp('hc-rp2','Ben','Lockhart',60,'L','L',{stuff:58,movement:62,control:60,stamina:48,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('hc-rp3','Kurt','Dempsey',45,'R','R',{stuff:68,movement:65,control:55,stamina:32,velocity:98,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('hc-rp4','Lenny','Bauer',63,'R','R',{stuff:55,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']}),
  mp('hc-rp5','Rob','Keane',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('hc-rp6','Jay','Ostrowski',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('hc-rp7','Vince','Purcell',73,'R','R',{stuff:48,movement:52,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:54,repertoire:['sinker','changeup','cutter']}),
];


// ═══════════════════════════════════════════════════════════
// AMERICAN LEAGUE CENTRAL
// ═══════════════════════════════════════════════════════════

// 6. Nashville Sounds — power-hitting, slugging team
const nashvilleSoundsPlayers: Player[] = [
  mb('ns-cf','Cedric','Banks',8,'CF','R','R',{cL:58,cR:62,pL:52,pR:58,eye:55,ak:50,gap:55,spd:75,stl:62,bnt:40,clt:52},{rng:80,arm:65,acc:65,dp:28,err:16}),
  mb('ns-2b','Danny','Hu',4,'2B','L','R',{cL:55,cR:65,pL:38,pR:42,eye:60,ak:58,gap:45,spd:62,stl:45,bnt:52,clt:48},{rng:70,arm:50,acc:68,dp:72,err:20}),
  mb('ns-ss','Jamal','Price',2,'SS','R','R',{cL:58,cR:62,pL:55,pR:62,eye:52,ak:48,gap:58,spd:68,stl:52,bnt:42,clt:55},{rng:74,arm:72,acc:70,dp:68,err:18}),
  mb('ns-1b','Bruno','Castellano',25,'1B','R','R',{cL:52,cR:60,pL:80,pR:88,eye:50,ak:38,gap:82,spd:25,stl:5,bnt:8,clt:68},{rng:50,arm:48,acc:55,dp:50,err:32}),
  mb('ns-rf','Trey','Hawkins',33,'RF','R','R',{cL:55,cR:62,pL:75,pR:82,eye:48,ak:40,gap:78,spd:42,stl:12,bnt:12,clt:70},{rng:55,arm:78,acc:65,dp:28,err:28}),
  mb('ns-dh','Marcus','Blaine',40,'DH','L','R',{cL:48,cR:62,pL:82,pR:90,eye:45,ak:35,gap:85,spd:25,stl:3,bnt:5,clt:72},{rng:20,arm:38,acc:38,dp:20,err:75}),
  mb('ns-3b','Wade','Garrett',15,'3B','R','R',{cL:52,cR:58,pL:72,pR:78,eye:48,ak:42,gap:72,spd:38,stl:15,bnt:22,clt:65},{rng:62,arm:72,acc:62,dp:52,err:28}),
  mb('ns-lf','Kirk','Donovan',22,'LF','L','L',{cL:50,cR:62,pL:70,pR:78,eye:50,ak:42,gap:72,spd:48,stl:22,bnt:15,clt:55},{rng:58,arm:55,acc:55,dp:25,err:32}),
  mb('ns-c','Hank','Novak',12,'C','R','R',{cL:52,cR:58,pL:58,pR:65,eye:50,ak:45,gap:60,spd:28,stl:5,bnt:18,clt:60},{rng:62,arm:70,acc:65,dp:42,err:25}),
  mb('ns-bn1','Zeke','Palmer',18,'RF','R','R',{cL:48,cR:55,pL:62,pR:68,eye:45,ak:38,gap:60,spd:42,stl:12,bnt:12,clt:55},{rng:52,arm:70,acc:58,dp:25,err:32}),
  mb('ns-bn2','Ray','Ibarra',6,'2B','R','R',{cL:52,cR:58,pL:30,pR:35,eye:55,ak:55,gap:38,spd:60,stl:45,bnt:50,clt:45},{rng:68,arm:48,acc:65,dp:70,err:22}),
  mb('ns-bn3','Mitch','Greer',36,'C','R','R',{cL:42,cR:50,pL:50,pR:55,eye:45,ak:42,gap:48,spd:25,stl:3,bnt:15,clt:52},{rng:58,arm:68,acc:60,dp:38,err:28}),
  mb('ns-bn4','Dusty','Rhodes',30,'1B','L','L',{cL:45,cR:55,pL:68,pR:72,eye:45,ak:38,gap:65,spd:25,stl:3,bnt:8,clt:55},{rng:48,arm:45,acc:50,dp:48,err:35}),
  mp('ns-sp1','Clint','Hargrove',47,'R','R',{stuff:68,movement:65,control:62,stamina:72,velocity:95,hold_runners:52,groundball_pct:45,repertoire:['fastball','slider','changeup','curveball']},29),
  mp('ns-sp2','Fernando','Leal',35,'L','L',{stuff:62,movement:64,control:60,stamina:70,velocity:92,hold_runners:55,groundball_pct:55,repertoire:['sinker','changeup','curveball']},27),
  mp('ns-sp3','Brock','Henning',41,'R','R',{stuff:58,movement:60,control:62,stamina:68,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider','changeup']},30),
  mp('ns-sp4','Gary','Pham',50,'R','R',{stuff:55,movement:58,control:60,stamina:66,velocity:91,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','curveball']},28),
  mp('ns-sp5','Artie','Contreras',29,'L','L',{stuff:52,movement:55,control:58,stamina:64,velocity:89,hold_runners:52,groundball_pct:58,repertoire:['sinker','changeup','curveball']},26),
  mp('ns-rp1','Bo','Strickland',55,'R','R',{stuff:68,movement:65,control:58,stamina:42,velocity:97,hold_runners:48,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('ns-rp2','Hugo','Arias',60,'L','L',{stuff:60,movement:62,control:58,stamina:48,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('ns-rp3','Lance','Bridges',45,'R','R',{stuff:72,movement:68,control:52,stamina:32,velocity:99,hold_runners:42,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('ns-rp4','Kent','Ogden',63,'R','R',{stuff:56,movement:55,control:58,stamina:50,velocity:94,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter','changeup']}),
  mp('ns-rp5','Carl','Dupree',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('ns-rp6','Wes','Tibbs',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('ns-rp7','Dean','Riggs',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:54,repertoire:['sinker','changeup','cutter']}),
];

// 7. Indianapolis Railmen — speed/defense team, slap hitters
const indianapolisRailmenPlayers: Player[] = [
  mb('ir-cf','Trevon','Ellis',1,'CF','S','R',{cL:68,cR:65,pL:30,pR:32,eye:62,ak:65,gap:38,spd:88,stl:82,bnt:60,clt:48},{rng:90,arm:62,acc:65,dp:28,err:10}),
  mb('ir-2b','Coby','Yuen',4,'2B','L','R',{cL:62,cR:70,pL:25,pR:28,eye:68,ak:70,gap:32,spd:72,stl:62,bnt:65,clt:48},{rng:80,arm:55,acc:75,dp:82,err:12}),
  mb('ir-ss','Omar','Reeves',2,'SS','R','R',{cL:65,cR:68,pL:32,pR:35,eye:62,ak:60,gap:40,spd:78,stl:70,bnt:55,clt:52},{rng:85,arm:72,acc:78,dp:78,err:10}),
  mb('ir-1b','Dale','Swanson',23,'1B','L','L',{cL:55,cR:65,pL:58,pR:65,eye:58,ak:52,gap:60,spd:35,stl:12,bnt:18,clt:52},{rng:58,arm:50,acc:62,dp:55,err:25}),
  mb('ir-rf','Kenny','Hood',21,'RF','R','R',{cL:60,cR:62,pL:48,pR:55,eye:58,ak:55,gap:52,spd:65,stl:48,bnt:35,clt:52},{rng:70,arm:72,acc:68,dp:30,err:18}),
  mb('ir-dh','Phil','Stanton',30,'DH','R','R',{cL:55,cR:60,pL:60,pR:68,eye:52,ak:45,gap:62,spd:32,stl:8,bnt:10,clt:58},{rng:20,arm:38,acc:38,dp:20,err:70}),
  mb('ir-3b','Nate','Shelby',14,'3B','R','R',{cL:58,cR:62,pL:48,pR:52,eye:58,ak:55,gap:50,spd:55,stl:32,bnt:40,clt:55},{rng:72,arm:70,acc:70,dp:58,err:18}),
  mb('ir-lf','Chris','Alvarado',17,'LF','L','R',{cL:55,cR:65,pL:42,pR:48,eye:55,ak:52,gap:48,spd:72,stl:60,bnt:42,clt:48},{rng:68,arm:58,acc:62,dp:28,err:22}),
  mb('ir-c','Luke','Hensley',12,'C','R','R',{cL:52,cR:58,pL:42,pR:48,eye:55,ak:55,gap:45,spd:30,stl:8,bnt:22,clt:58},{rng:72,arm:75,acc:72,dp:48,err:18}),
  mb('ir-bn1','Rico','Mata',9,'CF','R','R',{cL:50,cR:55,pL:25,pR:28,eye:52,ak:55,gap:30,spd:82,stl:75,bnt:58,clt:42},{rng:85,arm:58,acc:62,dp:25,err:12}),
  mb('ir-bn2','Glen','Forbes',6,'SS','R','R',{cL:55,cR:58,pL:28,pR:32,eye:55,ak:58,gap:35,spd:70,stl:58,bnt:55,clt:45},{rng:78,arm:65,acc:70,dp:72,err:15}),
  mb('ir-bn3','Jose','Lugo',36,'C','R','R',{cL:42,cR:48,pL:38,pR:42,eye:48,ak:50,gap:38,spd:28,stl:5,bnt:20,clt:52},{rng:65,arm:70,acc:65,dp:42,err:22}),
  mb('ir-bn4','Wally','Cross',38,'1B','L','L',{cL:45,cR:52,pL:52,pR:58,eye:50,ak:45,gap:52,spd:30,stl:5,bnt:12,clt:48},{rng:52,arm:45,acc:55,dp:50,err:30}),
  mp('ir-sp1','Shane','Whitaker',33,'R','R',{stuff:64,movement:66,control:68,stamina:72,velocity:92,hold_runners:58,groundball_pct:58,repertoire:['sinker','slider','changeup','curveball']},28),
  mp('ir-sp2','Drew','Kimura',41,'L','L',{stuff:60,movement:62,control:65,stamina:70,velocity:90,hold_runners:55,groundball_pct:60,repertoire:['sinker','changeup','curveball']},30),
  mp('ir-sp3','Garrett','Moody',49,'R','R',{stuff:58,movement:60,control:62,stamina:68,velocity:91,hold_runners:52,groundball_pct:55,repertoire:['fastball','cutter','changeup']},27),
  mp('ir-sp4','Seth','Truax',52,'R','R',{stuff:55,movement:58,control:60,stamina:66,velocity:90,hold_runners:50,groundball_pct:52,repertoire:['fastball','slider','changeup']},29),
  mp('ir-sp5','Vince','Espinal',37,'L','L',{stuff:52,movement:55,control:62,stamina:64,velocity:88,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup','curveball']},31),
  mp('ir-rp1','Max','Holt',55,'R','R',{stuff:65,movement:62,control:62,stamina:44,velocity:96,hold_runners:50,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('ir-rp2','Pablo','Serra',60,'L','L',{stuff:58,movement:62,control:58,stamina:48,velocity:91,hold_runners:55,groundball_pct:60,repertoire:['sinker','changeup']}),
  mp('ir-rp3','Russ','Canfield',45,'R','R',{stuff:68,movement:65,control:55,stamina:32,velocity:98,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('ir-rp4','Brad','Lovett',63,'R','R',{stuff:55,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']}),
  mp('ir-rp5','Ty','Bascom',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('ir-rp6','Jed','Pruitt',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('ir-rp7','Cliff','Menard',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// 8. Memphis Rivermen — balanced, groundball pitching staff
const memphisRivermenPlayers: Player[] = [
  mb('mr-cf','Lamar','Gibbs',8,'CF','R','R',{cL:60,cR:64,pL:42,pR:48,eye:58,ak:55,gap:48,spd:75,stl:65,bnt:45,clt:50},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('mr-2b','Kyle','Sutton',4,'2B','R','R',{cL:62,cR:66,pL:35,pR:40,eye:62,ak:62,gap:42,spd:62,stl:48,bnt:55,clt:50},{rng:72,arm:52,acc:70,dp:75,err:18}),
  mb('mr-ss','Rene','Valdez',2,'SS','S','R',{cL:60,cR:58,pL:38,pR:42,eye:58,ak:55,gap:42,spd:70,stl:58,bnt:52,clt:52},{rng:78,arm:70,acc:72,dp:72,err:16}),
  mb('mr-1b','Beau','Langford',24,'1B','L','L',{cL:52,cR:65,pL:68,pR:75,eye:55,ak:48,gap:70,spd:28,stl:5,bnt:10,clt:58},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('mr-rf','Will','Coffey',21,'RF','R','R',{cL:55,cR:62,pL:62,pR:68,eye:52,ak:48,gap:65,spd:50,stl:22,bnt:18,clt:55},{rng:60,arm:72,acc:62,dp:28,err:26}),
  mb('mr-dh','Cole','Drummond',35,'DH','R','R',{cL:50,cR:58,pL:68,pR:75,eye:50,ak:42,gap:70,spd:28,stl:5,bnt:8,clt:62},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('mr-3b','Dante','Mack',15,'3B','R','R',{cL:58,cR:62,pL:58,pR:65,eye:52,ak:48,gap:60,spd:42,stl:18,bnt:28,clt:58},{rng:68,arm:70,acc:65,dp:55,err:24}),
  mb('mr-lf','Tyrell','Moss',17,'LF','L','R',{cL:52,cR:62,pL:55,pR:62,eye:55,ak:50,gap:58,spd:60,stl:40,bnt:25,clt:50},{rng:62,arm:55,acc:58,dp:28,err:28}),
  mb('mr-c','Sal','Finch',12,'C','R','R',{cL:50,cR:56,pL:48,pR:52,eye:55,ak:52,gap:50,spd:30,stl:8,bnt:22,clt:58},{rng:70,arm:72,acc:70,dp:48,err:20}),
  mb('mr-bn1','Cedric','Duval',9,'LF','L','R',{cL:48,cR:55,pL:48,pR:55,eye:50,ak:48,gap:50,spd:58,stl:38,bnt:28,clt:45},{rng:58,arm:52,acc:55,dp:25,err:30}),
  mb('mr-bn2','Arturo','Paz',6,'SS','R','R',{cL:52,cR:56,pL:30,pR:32,eye:52,ak:55,gap:35,spd:65,stl:50,bnt:50,clt:45},{rng:72,arm:62,acc:68,dp:68,err:18}),
  mb('mr-bn3','Nolan','Cash',36,'C','R','R',{cL:42,cR:50,pL:45,pR:50,eye:48,ak:48,gap:45,spd:28,stl:5,bnt:18,clt:52},{rng:65,arm:68,acc:62,dp:40,err:25}),
  mb('mr-bn4','Earl','Gaines',38,'1B','R','R',{cL:45,cR:52,pL:60,pR:65,eye:45,ak:40,gap:58,spd:28,stl:3,bnt:8,clt:50},{rng:50,arm:45,acc:52,dp:48,err:32}),
  mp('mr-sp1','Barrett','Kemp',33,'R','R',{stuff:66,movement:68,control:66,stamina:74,velocity:92,hold_runners:55,groundball_pct:62,repertoire:['sinker','slider','changeup','curveball']},29),
  mp('mr-sp2','Jorge','Montoya',41,'R','R',{stuff:62,movement:65,control:64,stamina:70,velocity:91,hold_runners:52,groundball_pct:60,repertoire:['sinker','changeup','curveball']},28),
  mp('mr-sp3','Ian','Stovall',49,'L','L',{stuff:58,movement:62,control:62,stamina:68,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['sinker','curveball','changeup']},30),
  mp('mr-sp4','Chad','Nance',52,'R','R',{stuff:56,movement:60,control:60,stamina:66,velocity:91,hold_runners:50,groundball_pct:60,repertoire:['sinker','cutter','changeup']},27),
  mp('mr-sp5','Al','Ferreira',37,'R','R',{stuff:54,movement:58,control:62,stamina:64,velocity:89,hold_runners:48,groundball_pct:62,repertoire:['sinker','slider','changeup']},31),
  mp('mr-rp1','Dom','Aguilar',55,'R','R',{stuff:66,movement:68,control:60,stamina:42,velocity:95,hold_runners:50,groundball_pct:58,repertoire:['sinker','slider']}),
  mp('mr-rp2','Pat','Quiroz',60,'L','L',{stuff:58,movement:62,control:58,stamina:48,velocity:91,hold_runners:55,groundball_pct:62,repertoire:['sinker','changeup']}),
  mp('mr-rp3','Reggie','Pace',45,'R','R',{stuff:70,movement:68,control:55,stamina:32,velocity:97,hold_runners:45,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('mr-rp4','Eli','Thorpe',63,'R','R',{stuff:55,movement:58,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:58,repertoire:['sinker','cutter','changeup']}),
  mp('mr-rp5','Andy','Kern',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:60,repertoire:['sinker','curveball']}),
  mp('mr-rp6','Rich','Oakley',70,'R','R',{stuff:50,movement:55,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:55,repertoire:['sinker','slider']}),
  mp('mr-rp7','Gil','Hyde',73,'R','R',{stuff:48,movement:52,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:58,repertoire:['sinker','changeup','cutter']}),
];

// 9. Louisville Sluggers — all about power, K-heavy lineup
const louisvilleSluggerPlayers: Player[] = [
  mb('ls-cf','Byron','Hart',8,'CF','R','R',{cL:55,cR:58,pL:55,pR:62,eye:48,ak:42,gap:58,spd:72,stl:58,bnt:30,clt:50},{rng:78,arm:65,acc:65,dp:28,err:18}),
  mb('ls-2b','Todd','Chung',4,'2B','R','R',{cL:55,cR:60,pL:42,pR:48,eye:52,ak:48,gap:48,spd:58,stl:40,bnt:42,clt:48},{rng:68,arm:52,acc:65,dp:70,err:22}),
  mb('ls-ss','Andre','Molina',2,'SS','R','R',{cL:58,cR:62,pL:48,pR:55,eye:50,ak:45,gap:52,spd:65,stl:50,bnt:38,clt:52},{rng:72,arm:70,acc:68,dp:68,err:20}),
  mb('ls-1b','Bull','Craddock',25,'1B','R','R',{cL:48,cR:55,pL:85,pR:92,eye:42,ak:32,gap:88,spd:22,stl:2,bnt:5,clt:70},{rng:48,arm:45,acc:52,dp:48,err:35}),
  mb('ls-rf','Rex','Fontaine',33,'RF','R','R',{cL:52,cR:58,pL:78,pR:85,eye:45,ak:35,gap:80,spd:40,stl:10,bnt:10,clt:68},{rng:52,arm:78,acc:62,dp:28,err:30}),
  mb('ls-dh','Hank','Osborn',40,'DH','L','R',{cL:45,cR:58,pL:85,pR:90,eye:42,ak:30,gap:88,spd:22,stl:2,bnt:5,clt:75},{rng:20,arm:35,acc:35,dp:20,err:78}),
  mb('ls-3b','Rocco','Brandt',15,'3B','R','R',{cL:50,cR:55,pL:75,pR:80,eye:45,ak:38,gap:75,spd:35,stl:12,bnt:18,clt:65},{rng:60,arm:72,acc:60,dp:50,err:30}),
  mb('ls-lf','Mason','Flint',22,'LF','L','L',{cL:48,cR:58,pL:72,pR:78,eye:48,ak:40,gap:72,spd:45,stl:18,bnt:12,clt:55},{rng:55,arm:55,acc:52,dp:25,err:32}),
  mb('ls-c','Gus','Roper',12,'C','R','R',{cL:48,cR:55,pL:55,pR:62,eye:48,ak:45,gap:58,spd:28,stl:5,bnt:18,clt:58},{rng:62,arm:70,acc:65,dp:42,err:25}),
  mb('ls-bn1','Chip','Norris',18,'RF','R','R',{cL:45,cR:52,pL:65,pR:72,eye:42,ak:35,gap:65,spd:38,stl:8,bnt:8,clt:55},{rng:50,arm:72,acc:58,dp:25,err:32}),
  mb('ls-bn2','Eddie','Falk',6,'3B','R','R',{cL:48,cR:52,pL:58,pR:65,eye:45,ak:40,gap:60,spd:35,stl:10,bnt:18,clt:50},{rng:58,arm:65,acc:58,dp:50,err:28}),
  mb('ls-bn3','Pete','Harlan',36,'C','R','R',{cL:42,cR:48,pL:50,pR:55,eye:42,ak:40,gap:48,spd:25,stl:3,bnt:15,clt:52},{rng:58,arm:68,acc:60,dp:38,err:28}),
  mb('ls-bn4','Roy','Tuttle',38,'1B','L','L',{cL:42,cR:50,pL:68,pR:72,eye:40,ak:32,gap:68,spd:22,stl:2,bnt:5,clt:55},{rng:48,arm:42,acc:48,dp:45,err:38}),
  mp('ls-sp1','Axel','Drummond',47,'R','R',{stuff:62,movement:60,control:58,stamina:70,velocity:95,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider','changeup']},28),
  mp('ls-sp2','Cole','Hardin',35,'R','R',{stuff:58,movement:58,control:60,stamina:68,velocity:93,hold_runners:50,groundball_pct:45,repertoire:['fastball','curveball','changeup']},30),
  mp('ls-sp3','Manny','Ochoa',41,'L','L',{stuff:56,movement:58,control:58,stamina:66,velocity:90,hold_runners:52,groundball_pct:52,repertoire:['sinker','changeup','curveball']},27),
  mp('ls-sp4','Todd','Bledsoe',50,'R','R',{stuff:54,movement:55,control:58,stamina:64,velocity:91,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider','changeup']},29),
  mp('ls-sp5','Nick','Renfro',29,'R','R',{stuff:52,movement:52,control:58,stamina:62,velocity:90,hold_runners:45,groundball_pct:50,repertoire:['fastball','cutter','curveball']},31),
  mp('ls-rp1','Tito','Cruz',55,'R','R',{stuff:65,movement:62,control:58,stamina:42,velocity:97,hold_runners:48,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('ls-rp2','Wayne','Adler',60,'L','L',{stuff:58,movement:60,control:55,stamina:48,velocity:91,hold_runners:52,groundball_pct:55,repertoire:['sinker','changeup']}),
  mp('ls-rp3','Zack','Trimble',45,'R','R',{stuff:68,movement:65,control:52,stamina:30,velocity:99,hold_runners:42,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('ls-rp4','Miles','Quick',63,'R','R',{stuff:55,movement:52,control:58,stamina:50,velocity:94,hold_runners:48,groundball_pct:48,repertoire:['fastball','cutter']}),
  mp('ls-rp5','Ben','Coombs',66,'L','L',{stuff:52,movement:55,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('ls-rp6','Art','Wynn',70,'R','R',{stuff:50,movement:50,control:55,stamina:48,velocity:93,hold_runners:45,groundball_pct:45,repertoire:['fastball','slider']}),
  mp('ls-rp7','Ron','Sparks',73,'R','R',{stuff:48,movement:48,control:58,stamina:50,velocity:91,hold_runners:48,groundball_pct:50,repertoire:['sinker','changeup']}),
];

// 10. Omaha Pioneers — young, athletic, high-upside
const omahaPioneersPlayers: Player[] = [
  mb('op-cf','Jace','Whitfield',1,'CF','L','R',{cL:55,cR:65,pL:42,pR:48,eye:55,ak:52,gap:48,spd:82,stl:75,bnt:48,clt:45},{rng:85,arm:65,acc:65,dp:28,err:12},24),
  mb('op-2b','Kai','Nakamura',4,'2B','S','R',{cL:58,cR:60,pL:32,pR:35,eye:58,ak:58,gap:38,spd:70,stl:58,bnt:55,clt:45},{rng:75,arm:52,acc:70,dp:75,err:16},23),
  mb('op-ss','Lucas','Vega',2,'SS','R','R',{cL:62,cR:65,pL:42,pR:48,eye:55,ak:52,gap:48,spd:75,stl:62,bnt:48,clt:50},{rng:80,arm:72,acc:72,dp:72,err:14},22),
  mb('op-1b','Brody','Lang',25,'1B','L','L',{cL:50,cR:62,pL:65,pR:72,eye:52,ak:45,gap:68,spd:32,stl:8,bnt:12,clt:52},{rng:55,arm:48,acc:58,dp:52,err:28},25),
  mb('op-rf','Devon','Cash',21,'RF','R','R',{cL:55,cR:60,pL:58,pR:65,eye:50,ak:45,gap:60,spd:62,stl:42,bnt:22,clt:50},{rng:62,arm:72,acc:65,dp:28,err:22},24),
  mb('op-dh','Marco','Salas',30,'DH','R','R',{cL:48,cR:55,pL:68,pR:75,eye:45,ak:38,gap:70,spd:30,stl:5,bnt:8,clt:55},{rng:20,arm:38,acc:38,dp:20,err:72},26),
  mb('op-3b','Trevor','Paine',14,'3B','R','R',{cL:55,cR:60,pL:58,pR:62,eye:50,ak:48,gap:58,spd:48,stl:25,bnt:28,clt:52},{rng:68,arm:68,acc:65,dp:55,err:22},24),
  mb('op-lf','Ray','Hooper',17,'LF','L','R',{cL:50,cR:60,pL:55,pR:62,eye:52,ak:48,gap:58,spd:68,stl:55,bnt:28,clt:48},{rng:65,arm:58,acc:60,dp:28,err:25},23),
  mb('op-c','Milo','Creech',12,'C','R','R',{cL:50,cR:55,pL:45,pR:50,eye:52,ak:50,gap:48,spd:32,stl:10,bnt:22,clt:55},{rng:68,arm:72,acc:68,dp:45,err:22},25),
  mb('op-bn1','Santos','Mejia',9,'CF','R','R',{cL:48,cR:52,pL:35,pR:38,eye:48,ak:50,gap:38,spd:78,stl:68,bnt:48,clt:42},{rng:82,arm:60,acc:62,dp:25,err:14},22),
  mb('op-bn2','Flynn','Barrett',6,'SS','R','R',{cL:52,cR:55,pL:30,pR:35,eye:50,ak:52,gap:35,spd:68,stl:55,bnt:50,clt:42},{rng:75,arm:65,acc:68,dp:70,err:18},23),
  mb('op-bn3','Nate','Tull',36,'C','R','R',{cL:42,cR:48,pL:40,pR:45,eye:45,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:50},{rng:62,arm:68,acc:62,dp:40,err:25},24),
  mb('op-bn4','Jay','Egan',38,'1B','L','L',{cL:42,cR:52,pL:58,pR:62,eye:45,ak:40,gap:55,spd:28,stl:3,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30},25),
  mp('op-sp1','Zander','Cobb',33,'R','R',{stuff:65,movement:62,control:60,stamina:70,velocity:96,hold_runners:48,groundball_pct:45,repertoire:['fastball','slider','changeup','curveball']},23),
  mp('op-sp2','Tyler','Nash',41,'L','L',{stuff:60,movement:58,control:58,stamina:68,velocity:93,hold_runners:52,groundball_pct:52,repertoire:['fastball','curveball','changeup']},24),
  mp('op-sp3','Aaron','Steed',49,'R','R',{stuff:58,movement:60,control:56,stamina:66,velocity:94,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider','changeup']},22),
  mp('op-sp4','Cade','Lister',52,'R','R',{stuff:55,movement:55,control:55,stamina:64,velocity:93,hold_runners:45,groundball_pct:46,repertoire:['fastball','curveball','changeup']},23),
  mp('op-sp5','Ross','Tate',37,'L','L',{stuff:52,movement:52,control:55,stamina:62,velocity:91,hold_runners:50,groundball_pct:54,repertoire:['sinker','changeup','curveball']},25),
  mp('op-rp1','Gage','Penn',55,'R','R',{stuff:65,movement:62,control:55,stamina:42,velocity:98,hold_runners:45,groundball_pct:38,repertoire:['fastball','slider']},24),
  mp('op-rp2','Levi','Morales',60,'L','L',{stuff:58,movement:60,control:55,stamina:48,velocity:92,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup']},23),
  mp('op-rp3','Beck','Sloan',45,'R','R',{stuff:68,movement:62,control:50,stamina:30,velocity:100,hold_runners:42,groundball_pct:32,repertoire:['fastball','slider']},22),
  mp('op-rp4','Ivan','Quiroz',63,'R','R',{stuff:55,movement:55,control:55,stamina:48,velocity:94,hold_runners:48,groundball_pct:48,repertoire:['fastball','cutter']},24),
  mp('op-rp5','Finn','Buckley',66,'L','L',{stuff:52,movement:55,control:52,stamina:45,velocity:91,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']},23),
  mp('op-rp6','Kip','Langston',70,'R','R',{stuff:50,movement:50,control:55,stamina:48,velocity:93,hold_runners:45,groundball_pct:45,repertoire:['fastball','slider']},25),
  mp('op-rp7','Ty','Norwood',73,'R','R',{stuff:48,movement:48,control:55,stamina:50,velocity:91,hold_runners:48,groundball_pct:52,repertoire:['sinker','changeup']},24),
];


// ═══════════════════════════════════════════════════════════
// AMERICAN LEAGUE WEST
// ═══════════════════════════════════════════════════════════

// 11. Portland Timber Wolves — pitching & speed, Pacific NW grit
const portlandTimberWolvesPlayers: Player[] = [
  mb('ptw-cf','Nico','Bergman',1,'CF','L','R',{cL:58,cR:68,pL:38,pR:42,eye:62,ak:60,gap:45,spd:82,stl:75,bnt:52,clt:50},{rng:85,arm:65,acc:68,dp:28,err:10}),
  mb('ptw-2b','Shin','Ito',4,'2B','L','R',{cL:60,cR:68,pL:28,pR:32,eye:68,ak:68,gap:35,spd:68,stl:55,bnt:62,clt:48},{rng:78,arm:52,acc:72,dp:80,err:14}),
  mb('ptw-ss','Damian','Rojas',2,'SS','R','R',{cL:62,cR:65,pL:40,pR:45,eye:60,ak:58,gap:45,spd:75,stl:65,bnt:50,clt:55},{rng:82,arm:72,acc:75,dp:75,err:12}),
  mb('ptw-1b','Lars','Johansson',23,'1B','L','L',{cL:52,cR:64,pL:65,pR:72,eye:58,ak:50,gap:68,spd:30,stl:8,bnt:12,clt:55},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('ptw-rf','Bo','Chandler',21,'RF','R','R',{cL:55,cR:60,pL:58,pR:65,eye:52,ak:48,gap:60,spd:55,stl:28,bnt:20,clt:55},{rng:62,arm:75,acc:65,dp:28,err:22}),
  mb('ptw-dh','Clay','Prescott',35,'DH','R','R',{cL:50,cR:58,pL:65,pR:72,eye:52,ak:42,gap:68,spd:28,stl:5,bnt:8,clt:60},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('ptw-3b','Garrett','Lund',14,'3B','R','R',{cL:58,cR:62,pL:55,pR:60,eye:55,ak:52,gap:58,spd:45,stl:20,bnt:32,clt:55},{rng:70,arm:72,acc:68,dp:58,err:20}),
  mb('ptw-lf','Rory','McBride',17,'LF','L','R',{cL:52,cR:62,pL:52,pR:58,eye:55,ak:52,gap:55,spd:65,stl:50,bnt:30,clt:48},{rng:65,arm:58,acc:60,dp:28,err:25}),
  mb('ptw-c','Jared','Kline',12,'C','R','R',{cL:52,cR:58,pL:45,pR:52,eye:55,ak:52,gap:48,spd:30,stl:8,bnt:22,clt:58},{rng:70,arm:75,acc:72,dp:48,err:18}),
  mb('ptw-bn1','Cory','Sims',9,'CF','R','R',{cL:48,cR:55,pL:30,pR:35,eye:52,ak:52,gap:35,spd:78,stl:68,bnt:48,clt:42},{rng:82,arm:60,acc:62,dp:25,err:14}),
  mb('ptw-bn2','Teo','Reyes',6,'SS','S','R',{cL:52,cR:50,pL:28,pR:30,eye:55,ak:55,gap:32,spd:70,stl:58,bnt:55,clt:45},{rng:78,arm:65,acc:68,dp:72,err:16}),
  mb('ptw-bn3','Wes','Moran',36,'C','R','R',{cL:42,cR:50,pL:42,pR:48,eye:48,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:65,arm:70,acc:65,dp:42,err:22}),
  mb('ptw-bn4','Sam','Kirby',38,'1B','L','L',{cL:45,cR:52,pL:55,pR:62,eye:50,ak:45,gap:55,spd:28,stl:3,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('ptw-sp1','Eli','Thornton',33,'L','L',{stuff:72,movement:70,control:68,stamina:75,velocity:94,hold_runners:60,groundball_pct:55,repertoire:['fastball','curveball','changeup','sinker']},27),
  mp('ptw-sp2','Jake','Sandoval',41,'R','R',{stuff:66,movement:68,control:65,stamina:72,velocity:93,hold_runners:52,groundball_pct:58,repertoire:['sinker','slider','changeup']},29),
  mp('ptw-sp3','Ryan','Cho',49,'R','R',{stuff:62,movement:64,control:64,stamina:70,velocity:92,hold_runners:50,groundball_pct:52,repertoire:['fastball','slider','changeup','curveball']},26),
  mp('ptw-sp4','Nathan','Marsh',52,'L','L',{stuff:58,movement:62,control:62,stamina:68,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup','curveball']},30),
  mp('ptw-sp5','Owen','Caldwell',37,'R','R',{stuff:56,movement:58,control:60,stamina:66,velocity:91,hold_runners:48,groundball_pct:54,repertoire:['fastball','cutter','changeup']},28),
  mp('ptw-rp1','Dane','Faulkner',55,'R','R',{stuff:70,movement:68,control:65,stamina:42,velocity:97,hold_runners:52,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('ptw-rp2','Hugo','Silva',60,'L','L',{stuff:62,movement:65,control:60,stamina:48,velocity:91,hold_runners:58,groundball_pct:60,repertoire:['sinker','changeup','curveball']}),
  mp('ptw-rp3','Brock','Adkins',45,'R','R',{stuff:72,movement:68,control:55,stamina:32,velocity:99,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('ptw-rp4','Scott','Keeler',63,'R','R',{stuff:58,movement:58,control:62,stamina:50,velocity:94,hold_runners:50,groundball_pct:50,repertoire:['fastball','cutter','changeup']}),
  mp('ptw-rp5','Mark','Gentry',66,'L','L',{stuff:55,movement:60,control:55,stamina:45,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('ptw-rp6','Rick','Escobar',70,'R','R',{stuff:52,movement:55,control:58,stamina:48,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('ptw-rp7','Andy','Mays',73,'R','R',{stuff:50,movement:52,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// 12. Las Vegas Aces — flashy, high-offense, middling pitching
const lasVegasAcesPlayers: Player[] = [
  mb('lva-cf','Jayden','Storm',1,'CF','R','R',{cL:62,cR:65,pL:52,pR:58,eye:55,ak:48,gap:55,spd:78,stl:68,bnt:38,clt:52},{rng:80,arm:65,acc:65,dp:28,err:15}),
  mb('lva-2b','Mateo','Cruz',4,'2B','S','R',{cL:65,cR:68,pL:40,pR:45,eye:60,ak:55,gap:48,spd:65,stl:50,bnt:48,clt:52},{rng:70,arm:52,acc:68,dp:72,err:20}),
  mb('lva-ss','Ricky','Diamond',2,'SS','R','R',{cL:65,cR:70,pL:52,pR:58,eye:58,ak:52,gap:55,spd:72,stl:60,bnt:42,clt:58},{rng:75,arm:70,acc:70,dp:70,err:18}),
  mb('lva-1b','Tank','Morrison',25,'1B','R','R',{cL:55,cR:62,pL:80,pR:88,eye:48,ak:38,gap:82,spd:25,stl:3,bnt:5,clt:70},{rng:48,arm:48,acc:55,dp:50,err:32}),
  mb('lva-rf','Travis','Blaze',33,'RF','R','R',{cL:60,cR:68,pL:72,pR:78,eye:52,ak:42,gap:75,spd:52,stl:25,bnt:15,clt:65},{rng:58,arm:75,acc:65,dp:28,err:25}),
  mb('lva-dh','Ace','Calloway',40,'DH','L','R',{cL:52,cR:68,pL:78,pR:85,eye:50,ak:38,gap:80,spd:28,stl:5,bnt:8,clt:72},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('lva-3b','Benny','Vega',15,'3B','R','R',{cL:58,cR:65,pL:65,pR:72,eye:50,ak:45,gap:68,spd:42,stl:18,bnt:25,clt:60},{rng:62,arm:70,acc:62,dp:52,err:28}),
  mb('lva-lf','Rico','Santana',22,'LF','L','R',{cL:55,cR:65,pL:62,pR:70,eye:52,ak:45,gap:65,spd:58,stl:38,bnt:20,clt:52},{rng:58,arm:55,acc:55,dp:25,err:30}),
  mb('lva-c','Jack','Holden',12,'C','R','R',{cL:50,cR:58,pL:52,pR:58,eye:50,ak:48,gap:55,spd:30,stl:8,bnt:18,clt:58},{rng:62,arm:68,acc:62,dp:42,err:25}),
  mb('lva-bn1','Frankie','Vale',9,'LF','L','R',{cL:48,cR:58,pL:55,pR:62,eye:48,ak:42,gap:55,spd:55,stl:35,bnt:18,clt:48},{rng:55,arm:52,acc:52,dp:25,err:32}),
  mb('lva-bn2','Leo','Gamble',6,'2B','R','R',{cL:52,cR:58,pL:35,pR:40,eye:52,ak:50,gap:40,spd:60,stl:42,bnt:45,clt:45},{rng:65,arm:48,acc:62,dp:68,err:22}),
  mb('lva-bn3','Max','Reno',36,'C','R','R',{cL:42,cR:50,pL:48,pR:55,eye:45,ak:42,gap:48,spd:25,stl:3,bnt:15,clt:52},{rng:58,arm:65,acc:58,dp:38,err:28}),
  mb('lva-bn4','Trey','Fortune',38,'1B','R','R',{cL:45,cR:52,pL:65,pR:70,eye:42,ak:35,gap:62,spd:25,stl:3,bnt:5,clt:55},{rng:48,arm:45,acc:50,dp:45,err:35}),
  mp('lva-sp1','Cody','Sterling',33,'R','R',{stuff:62,movement:58,control:60,stamina:70,velocity:95,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider','changeup']},28),
  mp('lva-sp2','Vic','Navarro',41,'R','R',{stuff:58,movement:55,control:58,stamina:68,velocity:93,hold_runners:48,groundball_pct:45,repertoire:['fastball','curveball','changeup']},30),
  mp('lva-sp3','Ruben','Torres',49,'L','L',{stuff:56,movement:58,control:56,stamina:66,velocity:91,hold_runners:52,groundball_pct:52,repertoire:['sinker','changeup','curveball']},27),
  mp('lva-sp4','Dex','Monroe',52,'R','R',{stuff:54,movement:55,control:58,stamina:64,velocity:92,hold_runners:45,groundball_pct:48,repertoire:['fastball','slider','changeup']},29),
  mp('lva-sp5','Gio','Fuentes',37,'L','L',{stuff:52,movement:52,control:56,stamina:62,velocity:89,hold_runners:50,groundball_pct:54,repertoire:['sinker','changeup','curveball']},26),
  mp('lva-rp1','Blaze','Wagner',55,'R','R',{stuff:64,movement:60,control:55,stamina:42,velocity:98,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('lva-rp2','Santos','Medina',60,'L','L',{stuff:56,movement:60,control:55,stamina:48,velocity:91,hold_runners:52,groundball_pct:55,repertoire:['sinker','changeup']}),
  mp('lva-rp3','Rock','Jensen',45,'R','R',{stuff:66,movement:62,control:50,stamina:30,velocity:100,hold_runners:42,groundball_pct:30,repertoire:['fastball','slider']}),
  mp('lva-rp4','Wes','Doyle',63,'R','R',{stuff:54,movement:52,control:58,stamina:50,velocity:94,hold_runners:48,groundball_pct:48,repertoire:['fastball','cutter']}),
  mp('lva-rp5','Lou','Corbin',66,'L','L',{stuff:50,movement:55,control:52,stamina:45,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('lva-rp6','Al','Roybal',70,'R','R',{stuff:48,movement:50,control:55,stamina:48,velocity:92,hold_runners:45,groundball_pct:45,repertoire:['fastball','slider']}),
  mp('lva-rp7','Pete','Luna',73,'R','R',{stuff:46,movement:48,control:56,stamina:50,velocity:90,hold_runners:48,groundball_pct:50,repertoire:['sinker','changeup']}),
];

// 13. Salt Lake Raptors — scrappy, high contact, decent defense
const saltLakeRaptorsPlayers: Player[] = [
  mb('slr-cf','Tanner','Britt',8,'CF','R','R',{cL:62,cR:66,pL:38,pR:42,eye:60,ak:60,gap:45,spd:78,stl:65,bnt:48,clt:52},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('slr-2b','Hiro','Tanabe',4,'2B','L','R',{cL:65,cR:72,pL:28,pR:32,eye:68,ak:70,gap:35,spd:62,stl:48,bnt:62,clt:50},{rng:75,arm:52,acc:72,dp:78,err:15}),
  mb('slr-ss','Manny','Camacho',2,'SS','R','R',{cL:65,cR:68,pL:35,pR:40,eye:62,ak:60,gap:42,spd:70,stl:58,bnt:50,clt:55},{rng:78,arm:70,acc:72,dp:72,err:16}),
  mb('slr-1b','Chet','Harmon',24,'1B','L','L',{cL:55,cR:68,pL:60,pR:68,eye:60,ak:52,gap:65,spd:30,stl:8,bnt:15,clt:58},{rng:55,arm:48,acc:60,dp:55,err:26}),
  mb('slr-rf','Blake','Collier',21,'RF','R','R',{cL:58,cR:65,pL:55,pR:62,eye:55,ak:50,gap:58,spd:52,stl:25,bnt:22,clt:55},{rng:62,arm:72,acc:65,dp:28,err:24}),
  mb('slr-dh','Aldo','Ruiz',35,'DH','R','R',{cL:52,cR:62,pL:62,pR:70,eye:52,ak:45,gap:65,spd:28,stl:5,bnt:8,clt:60},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('slr-3b','Vince','Parr',15,'3B','R','R',{cL:60,cR:65,pL:52,pR:58,eye:58,ak:55,gap:55,spd:42,stl:18,bnt:32,clt:55},{rng:68,arm:68,acc:65,dp:55,err:22}),
  mb('slr-lf','Desmond','York',17,'LF','L','R',{cL:55,cR:65,pL:48,pR:55,eye:55,ak:52,gap:52,spd:62,stl:45,bnt:30,clt:50},{rng:62,arm:55,acc:58,dp:28,err:28}),
  mb('slr-c','Brock','Henley',12,'C','R','R',{cL:55,cR:60,pL:45,pR:52,eye:55,ak:52,gap:48,spd:30,stl:8,bnt:22,clt:58},{rng:68,arm:72,acc:70,dp:48,err:20}),
  mb('slr-bn1','Efren','Soto',9,'LF','L','R',{cL:48,cR:58,pL:42,pR:48,eye:50,ak:50,gap:45,spd:58,stl:38,bnt:28,clt:45},{rng:58,arm:52,acc:55,dp:25,err:28}),
  mb('slr-bn2','Quinn','Norris',6,'2B','R','R',{cL:55,cR:60,pL:25,pR:28,eye:58,ak:60,gap:30,spd:60,stl:45,bnt:55,clt:45},{rng:72,arm:50,acc:68,dp:74,err:18}),
  mb('slr-bn3','Joe','Ott',36,'C','R','R',{cL:42,cR:50,pL:42,pR:48,eye:48,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:62,arm:68,acc:62,dp:40,err:25}),
  mb('slr-bn4','Kent','Deal',38,'1B','R','R',{cL:45,cR:55,pL:55,pR:60,eye:48,ak:42,gap:52,spd:28,stl:3,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('slr-sp1','Austin','Gale',33,'R','R',{stuff:64,movement:64,control:66,stamina:72,velocity:93,hold_runners:52,groundball_pct:52,repertoire:['fastball','slider','changeup','curveball']},28),
  mp('slr-sp2','Colby','Pham',41,'L','L',{stuff:60,movement:62,control:64,stamina:70,velocity:91,hold_runners:55,groundball_pct:56,repertoire:['sinker','curveball','changeup']},29),
  mp('slr-sp3','Russ','Harlan',49,'R','R',{stuff:58,movement:60,control:62,stamina:68,velocity:92,hold_runners:50,groundball_pct:50,repertoire:['fastball','slider','changeup']},27),
  mp('slr-sp4','Tomas','Lucero',52,'R','R',{stuff:55,movement:58,control:60,stamina:66,velocity:90,hold_runners:48,groundball_pct:54,repertoire:['sinker','cutter','changeup']},30),
  mp('slr-sp5','Adam','Boone',37,'L','L',{stuff:52,movement:55,control:62,stamina:64,velocity:89,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup','curveball']},31),
  mp('slr-rp1','Derek','Foley',55,'R','R',{stuff:65,movement:62,control:60,stamina:42,velocity:96,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('slr-rp2','Cesar','Rojas',60,'L','L',{stuff:58,movement:62,control:58,stamina:48,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('slr-rp3','Troy','Baines',45,'R','R',{stuff:68,movement:65,control:55,stamina:32,velocity:98,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('slr-rp4','Mike','Whalen',63,'R','R',{stuff:55,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']}),
  mp('slr-rp5','Juan','Bermudez',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('slr-rp6','Todd','Lusk',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('slr-rp7','Kyle','Fisk',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// 14. Sacramento Gold Rush — hot bats, suspect pitching
const sacramentoGoldRushPlayers: Player[] = [
  mb('sgr-cf','DJ','Saunders',1,'CF','S','R',{cL:65,cR:62,pL:45,pR:48,eye:58,ak:52,gap:50,spd:80,stl:72,bnt:42,clt:52},{rng:82,arm:65,acc:65,dp:28,err:14}),
  mb('sgr-2b','Felix','Aguilar',4,'2B','R','R',{cL:65,cR:70,pL:38,pR:42,eye:62,ak:58,gap:45,spd:62,stl:45,bnt:50,clt:52},{rng:70,arm:52,acc:68,dp:72,err:20}),
  mb('sgr-ss','Trey','Calderon',2,'SS','R','R',{cL:62,cR:68,pL:48,pR:55,eye:55,ak:50,gap:52,spd:68,stl:55,bnt:40,clt:55},{rng:72,arm:70,acc:68,dp:68,err:20}),
  mb('sgr-1b','Rex','McCoy',25,'1B','L','L',{cL:55,cR:68,pL:75,pR:82,eye:55,ak:45,gap:78,spd:28,stl:5,bnt:10,clt:62},{rng:52,arm:48,acc:55,dp:50,err:30}),
  mb('sgr-rf','Cruz','Delgado',33,'RF','R','R',{cL:60,cR:68,pL:70,pR:78,eye:52,ak:42,gap:72,spd:48,stl:20,bnt:15,clt:65},{rng:58,arm:75,acc:62,dp:28,err:26}),
  mb('sgr-dh','Bear','Holliday',40,'DH','R','R',{cL:50,cR:60,pL:80,pR:85,eye:48,ak:35,gap:82,spd:25,stl:3,bnt:5,clt:70},{rng:20,arm:38,acc:38,dp:20,err:75}),
  mb('sgr-3b','Shane','Orozco',15,'3B','R','R',{cL:58,cR:65,pL:65,pR:72,eye:50,ak:45,gap:68,spd:40,stl:15,bnt:22,clt:60},{rng:62,arm:70,acc:62,dp:52,err:26}),
  mb('sgr-lf','Miles','Flynn',22,'LF','L','L',{cL:52,cR:64,pL:65,pR:72,eye:50,ak:42,gap:68,spd:52,stl:30,bnt:18,clt:52},{rng:58,arm:55,acc:55,dp:25,err:30}),
  mb('sgr-c','Nolan','Huff',12,'C','R','R',{cL:50,cR:58,pL:52,pR:58,eye:50,ak:48,gap:55,spd:28,stl:5,bnt:18,clt:58},{rng:62,arm:68,acc:62,dp:42,err:25}),
  mb('sgr-bn1','Benji','Tran',9,'CF','L','R',{cL:48,cR:58,pL:38,pR:42,eye:50,ak:48,gap:42,spd:75,stl:62,bnt:40,clt:45},{rng:78,arm:58,acc:60,dp:25,err:18}),
  mb('sgr-bn2','Otto','Rios',6,'3B','R','R',{cL:50,cR:55,pL:55,pR:62,eye:45,ak:40,gap:58,spd:38,stl:12,bnt:18,clt:52},{rng:58,arm:65,acc:58,dp:50,err:28}),
  mb('sgr-bn3','Cam','Lyle',36,'C','R','R',{cL:42,cR:50,pL:48,pR:52,eye:45,ak:42,gap:48,spd:25,stl:3,bnt:15,clt:52},{rng:58,arm:65,acc:58,dp:38,err:28}),
  mb('sgr-bn4','Van','Pruett',38,'1B','L','L',{cL:45,cR:55,pL:62,pR:68,eye:45,ak:38,gap:60,spd:25,stl:3,bnt:5,clt:50},{rng:48,arm:42,acc:48,dp:45,err:35}),
  mp('sgr-sp1','Diego','Fuentes',33,'R','R',{stuff:60,movement:58,control:60,stamina:70,velocity:94,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider','changeup']},28),
  mp('sgr-sp2','Gabe','Hewitt',41,'R','R',{stuff:56,movement:55,control:58,stamina:68,velocity:93,hold_runners:48,groundball_pct:45,repertoire:['fastball','curveball','changeup']},30),
  mp('sgr-sp3','Perry','Lam',49,'L','L',{stuff:54,movement:56,control:56,stamina:66,velocity:90,hold_runners:52,groundball_pct:52,repertoire:['sinker','changeup','curveball']},27),
  mp('sgr-sp4','Cole','Wick',52,'R','R',{stuff:52,movement:52,control:58,stamina:64,velocity:92,hold_runners:45,groundball_pct:48,repertoire:['fastball','slider','changeup']},29),
  mp('sgr-sp5','Shane','Burch',37,'R','R',{stuff:50,movement:50,control:56,stamina:62,velocity:90,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter','curveball']},31),
  mp('sgr-rp1','Dion','Kirk',55,'R','R',{stuff:62,movement:58,control:55,stamina:42,velocity:97,hold_runners:45,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('sgr-rp2','Ivan','Sosa',60,'L','L',{stuff:55,movement:58,control:55,stamina:48,velocity:91,hold_runners:52,groundball_pct:55,repertoire:['sinker','changeup']}),
  mp('sgr-rp3','Ross','Vance',45,'R','R',{stuff:66,movement:62,control:50,stamina:30,velocity:99,hold_runners:42,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('sgr-rp4','Jeff','Logue',63,'R','R',{stuff:52,movement:52,control:58,stamina:50,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','cutter']}),
  mp('sgr-rp5','Mario','Cardenas',66,'L','L',{stuff:50,movement:55,control:52,stamina:45,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('sgr-rp6','Cliff','Hobson',70,'R','R',{stuff:48,movement:48,control:55,stamina:48,velocity:92,hold_runners:45,groundball_pct:45,repertoire:['fastball','slider']}),
  mp('sgr-rp7','Ken','Ziegler',73,'R','R',{stuff:46,movement:48,control:58,stamina:50,velocity:90,hold_runners:48,groundball_pct:50,repertoire:['sinker','changeup']}),
];

// 15. Albuquerque Sidewinders — high strikeout pitching, desert heat
const albuquerqueSidewindersPlayers: Player[] = [
  mb('asw-cf','Tre','Nash',8,'CF','R','R',{cL:60,cR:62,pL:42,pR:48,eye:55,ak:52,gap:48,spd:78,stl:65,bnt:42,clt:50},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('asw-2b','Kenta','Yamada',4,'2B','L','R',{cL:60,cR:68,pL:30,pR:35,eye:62,ak:62,gap:38,spd:62,stl:48,bnt:55,clt:48},{rng:72,arm:52,acc:70,dp:76,err:18}),
  mb('asw-ss','Luis','Esparza',2,'SS','R','R',{cL:60,cR:64,pL:42,pR:48,eye:58,ak:55,gap:48,spd:72,stl:60,bnt:48,clt:55},{rng:78,arm:70,acc:72,dp:72,err:16}),
  mb('asw-1b','Butch','Davenport',24,'1B','L','L',{cL:52,cR:65,pL:68,pR:75,eye:55,ak:48,gap:70,spd:28,stl:5,bnt:10,clt:58},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('asw-rf','Kane','Proctor',21,'RF','R','R',{cL:58,cR:62,pL:60,pR:68,eye:52,ak:48,gap:62,spd:52,stl:25,bnt:18,clt:55},{rng:60,arm:72,acc:62,dp:28,err:25}),
  mb('asw-dh','Jax','Holloway',35,'DH','R','R',{cL:50,cR:58,pL:68,pR:75,eye:48,ak:40,gap:70,spd:28,stl:5,bnt:8,clt:62},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('asw-3b','Reno','Galvez',15,'3B','R','R',{cL:58,cR:62,pL:58,pR:65,eye:52,ak:48,gap:60,spd:42,stl:18,bnt:28,clt:58},{rng:68,arm:70,acc:65,dp:55,err:24}),
  mb('asw-lf','Wyatt','Thorn',17,'LF','L','R',{cL:52,cR:62,pL:55,pR:62,eye:55,ak:50,gap:58,spd:60,stl:42,bnt:25,clt:48},{rng:60,arm:55,acc:55,dp:25,err:28}),
  mb('asw-c','Eli','Zuniga',12,'C','R','R',{cL:52,cR:58,pL:48,pR:55,eye:52,ak:50,gap:50,spd:30,stl:8,bnt:22,clt:58},{rng:68,arm:72,acc:68,dp:45,err:22}),
  mb('asw-bn1','Ray','Pacheco',9,'CF','R','R',{cL:48,cR:55,pL:32,pR:38,eye:50,ak:50,gap:38,spd:72,stl:60,bnt:45,clt:42},{rng:78,arm:58,acc:60,dp:25,err:16}),
  mb('asw-bn2','Nico','Ayala',6,'SS','R','R',{cL:52,cR:58,pL:28,pR:32,eye:52,ak:55,gap:32,spd:68,stl:52,bnt:52,clt:45},{rng:72,arm:62,acc:68,dp:68,err:18}),
  mb('asw-bn3','Sal','Montero',36,'C','R','R',{cL:42,cR:50,pL:42,pR:48,eye:48,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:62,arm:68,acc:62,dp:40,err:25}),
  mb('asw-bn4','Glen','Fry',38,'1B','R','R',{cL:45,cR:52,pL:58,pR:65,eye:45,ak:40,gap:58,spd:28,stl:3,bnt:8,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('asw-sp1','Flint','Calloway',33,'R','R',{stuff:72,movement:68,control:62,stamina:72,velocity:97,hold_runners:50,groundball_pct:38,repertoire:['fastball','slider','changeup','splitter']},27),
  mp('asw-sp2','Gunner','Black',41,'R','R',{stuff:68,movement:65,control:60,stamina:70,velocity:96,hold_runners:48,groundball_pct:40,repertoire:['fastball','slider','curveball']},29),
  mp('asw-sp3','Tristan','Quiroz',49,'L','L',{stuff:64,movement:62,control:58,stamina:68,velocity:93,hold_runners:52,groundball_pct:48,repertoire:['fastball','curveball','changeup']},26),
  mp('asw-sp4','Dax','Ritter',52,'R','R',{stuff:60,movement:58,control:58,stamina:66,velocity:94,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider','changeup']},28),
  mp('asw-sp5','Leo','Portillo',37,'R','R',{stuff:56,movement:55,control:58,stamina:64,velocity:93,hold_runners:45,groundball_pct:45,repertoire:['fastball','cutter','curveball']},30),
  mp('asw-rp1','Jet','Keller',55,'R','R',{stuff:72,movement:68,control:58,stamina:40,velocity:100,hold_runners:48,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('asw-rp2','Omar','Villegas',60,'L','L',{stuff:62,movement:65,control:58,stamina:48,velocity:92,hold_runners:55,groundball_pct:55,repertoire:['sinker','changeup','curveball']}),
  mp('asw-rp3','Nash','Ware',45,'R','R',{stuff:70,movement:65,control:52,stamina:30,velocity:101,hold_runners:42,groundball_pct:28,repertoire:['fastball','slider']}),
  mp('asw-rp4','Cade','Lomax',63,'R','R',{stuff:58,movement:55,control:58,stamina:50,velocity:95,hold_runners:48,groundball_pct:45,repertoire:['fastball','cutter']}),
  mp('asw-rp5','Tony','Baca',66,'L','L',{stuff:55,movement:60,control:52,stamina:45,velocity:91,hold_runners:52,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('asw-rp6','Hank','Pollard',70,'R','R',{stuff:52,movement:52,control:55,stamina:48,velocity:94,hold_runners:45,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('asw-rp7','Ernie','Duran',73,'R','R',{stuff:50,movement:50,control:58,stamina:50,velocity:92,hold_runners:48,groundball_pct:48,repertoire:['fastball','changeup']}),
];


// ═══════════════════════════════════════════════════════════
// NATIONAL LEAGUE EAST
// ═══════════════════════════════════════════════════════════

// 16. Savannah Sandgnats — contact-heavy, veteran squad
const savannahSandgnatsPlayers: Player[] = [
  mb('sg-cf','Reggie','Flowers',8,'CF','L','R',{cL:58,cR:68,pL:38,pR:42,eye:62,ak:60,gap:45,spd:75,stl:62,bnt:50,clt:52},{rng:78,arm:62,acc:65,dp:28,err:16},31),
  mb('sg-2b','Danny','Stokes',4,'2B','R','R',{cL:68,cR:72,pL:30,pR:35,eye:70,ak:70,gap:38,spd:58,stl:42,bnt:60,clt:52},{rng:72,arm:50,acc:70,dp:75,err:18},32),
  mb('sg-ss','Terrell','Franklin',2,'SS','R','R',{cL:65,cR:68,pL:35,pR:40,eye:62,ak:58,gap:42,spd:65,stl:50,bnt:48,clt:58},{rng:75,arm:68,acc:70,dp:70,err:18},30),
  mb('sg-1b','Hoss','McAllister',24,'1B','L','L',{cL:55,cR:68,pL:68,pR:75,eye:58,ak:50,gap:70,spd:28,stl:5,bnt:10,clt:62},{rng:55,arm:48,acc:58,dp:52,err:28},33),
  mb('sg-rf','Clyde','Ashford',21,'RF','R','R',{cL:60,cR:66,pL:58,pR:65,eye:55,ak:52,gap:62,spd:48,stl:20,bnt:20,clt:58},{rng:58,arm:72,acc:62,dp:28,err:26},30),
  mb('sg-dh','Walt','Gibbons',35,'DH','R','R',{cL:55,cR:62,pL:65,pR:72,eye:55,ak:48,gap:68,spd:25,stl:3,bnt:8,clt:65},{rng:20,arm:38,acc:38,dp:20,err:72},34),
  mb('sg-3b','Cal','Roberson',15,'3B','R','R',{cL:62,cR:66,pL:55,pR:62,eye:58,ak:55,gap:58,spd:38,stl:12,bnt:32,clt:58},{rng:68,arm:68,acc:65,dp:55,err:24},31),
  mb('sg-lf','Amos','Webb',17,'LF','L','R',{cL:55,cR:65,pL:50,pR:58,eye:58,ak:55,gap:55,spd:55,stl:35,bnt:28,clt:52},{rng:60,arm:55,acc:58,dp:28,err:28},29),
  mb('sg-c','Roy','Whitley',12,'C','R','R',{cL:55,cR:62,pL:48,pR:55,eye:58,ak:55,gap:52,spd:28,stl:5,bnt:22,clt:60},{rng:70,arm:72,acc:70,dp:48,err:20},32),
  mb('sg-bn1','Jesse','Bray',9,'LF','R','R',{cL:50,cR:58,pL:45,pR:52,eye:52,ak:50,gap:48,spd:52,stl:32,bnt:25,clt:48},{rng:58,arm:52,acc:55,dp:25,err:30}),
  mb('sg-bn2','Earl','Mosley',6,'2B','R','R',{cL:58,cR:62,pL:25,pR:28,eye:60,ak:62,gap:30,spd:55,stl:38,bnt:55,clt:48},{rng:68,arm:48,acc:65,dp:72,err:20}),
  mb('sg-bn3','Ned','Poole',36,'C','R','R',{cL:45,cR:52,pL:42,pR:48,eye:50,ak:50,gap:45,spd:25,stl:3,bnt:18,clt:55},{rng:62,arm:68,acc:62,dp:40,err:25}),
  mb('sg-bn4','Buck','Trammell',38,'1B','L','L',{cL:48,cR:58,pL:58,pR:65,eye:50,ak:45,gap:58,spd:25,stl:3,bnt:8,clt:52},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('sg-sp1','Vernon','Posey',33,'R','R',{stuff:64,movement:66,control:68,stamina:72,velocity:92,hold_runners:55,groundball_pct:55,repertoire:['sinker','slider','changeup','curveball']},30),
  mp('sg-sp2','Rufus','Tate',41,'L','L',{stuff:62,movement:62,control:65,stamina:70,velocity:90,hold_runners:58,groundball_pct:58,repertoire:['sinker','curveball','changeup']},31),
  mp('sg-sp3','Wes','Conley',49,'R','R',{stuff:58,movement:60,control:62,stamina:68,velocity:91,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']},29),
  mp('sg-sp4','Bo','Hutchins',52,'R','R',{stuff:56,movement:58,control:62,stamina:66,velocity:90,hold_runners:52,groundball_pct:55,repertoire:['sinker','slider','changeup']},32),
  mp('sg-sp5','Lonnie','Case',37,'L','L',{stuff:54,movement:56,control:62,stamina:64,velocity:88,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup','curveball']},33),
  mp('sg-rp1','Otis','Langley',55,'R','R',{stuff:65,movement:65,control:62,stamina:44,velocity:95,hold_runners:52,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('sg-rp2','Stu','Whitehead',60,'L','L',{stuff:58,movement:62,control:60,stamina:48,velocity:90,hold_runners:55,groundball_pct:60,repertoire:['sinker','changeup']}),
  mp('sg-rp3','Al','Griggs',45,'R','R',{stuff:68,movement:65,control:55,stamina:32,velocity:97,hold_runners:45,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('sg-rp4','Ned','Pickett',63,'R','R',{stuff:55,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['sinker','cutter','changeup']}),
  mp('sg-rp5','Gus','Kimble',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:89,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('sg-rp6','Floyd','Mims',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:50,repertoire:['fastball','slider']}),
  mp('sg-rp7','Hal','Wilkins',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// 17. Richmond Rebels — aggressive baserunning, doubles machine
const richmondRebelsPlayers: Player[] = [
  mb('rr-cf','Marcus','Bell',1,'CF','S','R',{cL:65,cR:62,pL:38,pR:42,eye:58,ak:55,gap:52,spd:85,stl:78,bnt:55,clt:50},{rng:88,arm:65,acc:68,dp:28,err:10}),
  mb('rr-2b','Hector','Nieves',4,'2B','R','R',{cL:62,cR:68,pL:32,pR:38,eye:60,ak:58,gap:48,spd:68,stl:55,bnt:52,clt:50},{rng:72,arm:52,acc:70,dp:75,err:18}),
  mb('rr-ss','Quinn','Mercer',2,'SS','L','R',{cL:58,cR:65,pL:38,pR:42,eye:60,ak:58,gap:52,spd:75,stl:65,bnt:52,clt:55},{rng:78,arm:68,acc:72,dp:72,err:15}),
  mb('rr-1b','Ford','McKenna',25,'1B','L','L',{cL:55,cR:68,pL:65,pR:72,eye:58,ak:50,gap:72,spd:32,stl:10,bnt:12,clt:58},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('rr-rf','Lance','Powers',33,'RF','R','R',{cL:58,cR:65,pL:58,pR:65,eye:52,ak:48,gap:68,spd:58,stl:38,bnt:18,clt:58},{rng:62,arm:72,acc:65,dp:28,err:22}),
  mb('rr-dh','Clay','Irving',40,'DH','R','R',{cL:52,cR:60,pL:62,pR:70,eye:52,ak:45,gap:72,spd:35,stl:12,bnt:10,clt:60},{rng:20,arm:38,acc:38,dp:20,err:70}),
  mb('rr-3b','Denny','Foxx',15,'3B','R','R',{cL:58,cR:65,pL:55,pR:62,eye:55,ak:50,gap:65,spd:48,stl:28,bnt:28,clt:55},{rng:68,arm:70,acc:65,dp:55,err:24}),
  mb('rr-lf','Brent','Yarbrough',22,'LF','L','R',{cL:55,cR:65,pL:52,pR:60,eye:55,ak:52,gap:62,spd:68,stl:55,bnt:28,clt:50},{rng:65,arm:58,acc:60,dp:28,err:25}),
  mb('rr-c','Mack','Underwood',12,'C','R','R',{cL:52,cR:58,pL:48,pR:55,eye:55,ak:52,gap:52,spd:32,stl:10,bnt:22,clt:58},{rng:65,arm:70,acc:68,dp:45,err:22}),
  mb('rr-bn1','Russ','Peyton',9,'CF','R','R',{cL:50,cR:55,pL:30,pR:35,eye:50,ak:52,gap:38,spd:78,stl:68,bnt:52,clt:42},{rng:82,arm:60,acc:62,dp:25,err:14}),
  mb('rr-bn2','Otto','Keyes',6,'SS','R','R',{cL:52,cR:58,pL:30,pR:35,eye:52,ak:55,gap:38,spd:68,stl:55,bnt:50,clt:45},{rng:75,arm:62,acc:68,dp:70,err:18}),
  mb('rr-bn3','Grady','Voss',36,'C','R','R',{cL:42,cR:50,pL:42,pR:48,eye:48,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:62,arm:68,acc:62,dp:40,err:25}),
  mb('rr-bn4','Hugh','Blevins',38,'1B','L','L',{cL:45,cR:55,pL:58,pR:62,eye:48,ak:42,gap:55,spd:28,stl:5,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('rr-sp1','Floyd','Ambrose',33,'R','R',{stuff:66,movement:64,control:64,stamina:72,velocity:93,hold_runners:55,groundball_pct:52,repertoire:['fastball','slider','changeup','curveball']},28),
  mp('rr-sp2','Hank','Downing',41,'L','L',{stuff:62,movement:62,control:62,stamina:70,velocity:91,hold_runners:55,groundball_pct:55,repertoire:['sinker','curveball','changeup']},30),
  mp('rr-sp3','Mick','Lackey',49,'R','R',{stuff:58,movement:60,control:60,stamina:68,velocity:92,hold_runners:50,groundball_pct:50,repertoire:['fastball','slider','changeup']},27),
  mp('rr-sp4','Gabe','Fulton',52,'R','R',{stuff:56,movement:58,control:60,stamina:66,velocity:90,hold_runners:48,groundball_pct:54,repertoire:['sinker','cutter','changeup']},29),
  mp('rr-sp5','Rex','Glover',37,'L','L',{stuff:54,movement:55,control:58,stamina:64,velocity:89,hold_runners:52,groundball_pct:56,repertoire:['fastball','changeup','curveball']},31),
  mp('rr-rp1','Ned','Savage',55,'R','R',{stuff:66,movement:62,control:58,stamina:42,velocity:96,hold_runners:48,groundball_pct:40,repertoire:['fastball','slider']}),
  mp('rr-rp2','Otto','Paz',60,'L','L',{stuff:58,movement:60,control:58,stamina:48,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('rr-rp3','Ken','Brock',45,'R','R',{stuff:70,movement:65,control:55,stamina:32,velocity:98,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('rr-rp4','Sid','Hyde',63,'R','R',{stuff:55,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']}),
  mp('rr-rp5','Gus','Nash',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('rr-rp6','Vic','Daly',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('rr-rp7','Phil','Yost',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:54,repertoire:['sinker','changeup','cutter']}),
];

// 18. Montreal Voyageurs — bilingual flair, finesse pitching
const montrealVoyageursPlayers: Player[] = [
  mb('mv-cf','Pascal','Lefebvre',1,'CF','L','R',{cL:58,cR:68,pL:40,pR:45,eye:62,ak:60,gap:48,spd:78,stl:68,bnt:50,clt:52},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('mv-2b','Remi','Bouchard',4,'2B','S','R',{cL:65,cR:68,pL:30,pR:35,eye:68,ak:68,gap:38,spd:65,stl:52,bnt:58,clt:50},{rng:75,arm:52,acc:72,dp:78,err:16}),
  mb('mv-ss','Marcel','Dupont',2,'SS','R','R',{cL:62,cR:66,pL:38,pR:42,eye:60,ak:58,gap:45,spd:72,stl:60,bnt:50,clt:55},{rng:78,arm:70,acc:72,dp:72,err:15}),
  mb('mv-1b','Jean','Moreau',24,'1B','L','L',{cL:55,cR:68,pL:62,pR:70,eye:60,ak:52,gap:66,spd:30,stl:8,bnt:12,clt:58},{rng:55,arm:48,acc:60,dp:52,err:26}),
  mb('mv-rf','Andre','Cormier',21,'RF','R','R',{cL:58,cR:64,pL:55,pR:62,eye:55,ak:50,gap:58,spd:52,stl:28,bnt:22,clt:55},{rng:62,arm:72,acc:65,dp:28,err:24}),
  mb('mv-dh','Gaston','Bergeron',35,'DH','L','R',{cL:52,cR:65,pL:62,pR:70,eye:58,ak:48,gap:65,spd:28,stl:5,bnt:8,clt:62},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('mv-3b','Louis','Tremblay',15,'3B','R','R',{cL:60,cR:65,pL:52,pR:58,eye:58,ak:55,gap:55,spd:42,stl:18,bnt:32,clt:55},{rng:70,arm:70,acc:68,dp:58,err:22}),
  mb('mv-lf','Claude','Gagnon',17,'LF','L','R',{cL:52,cR:64,pL:48,pR:55,eye:58,ak:55,gap:52,spd:62,stl:48,bnt:30,clt:50},{rng:62,arm:55,acc:58,dp:28,err:28}),
  mb('mv-c','Pierre','Lavoie',12,'C','R','R',{cL:55,cR:60,pL:42,pR:48,eye:58,ak:55,gap:45,spd:30,stl:8,bnt:22,clt:60},{rng:72,arm:75,acc:72,dp:48,err:18}),
  mb('mv-bn1','Alain','Roy',9,'CF','L','R',{cL:48,cR:58,pL:32,pR:38,eye:52,ak:55,gap:38,spd:72,stl:62,bnt:48,clt:42},{rng:78,arm:58,acc:60,dp:25,err:16}),
  mb('mv-bn2','Guy','Pelletier',6,'SS','R','R',{cL:52,cR:58,pL:28,pR:32,eye:55,ak:55,gap:32,spd:65,stl:50,bnt:55,clt:45},{rng:72,arm:62,acc:68,dp:70,err:18}),
  mb('mv-bn3','Rene','Picard',36,'C','R','R',{cL:42,cR:50,pL:40,pR:45,eye:50,ak:50,gap:42,spd:28,stl:5,bnt:18,clt:55},{rng:65,arm:70,acc:65,dp:42,err:22}),
  mb('mv-bn4','Serge','Belanger',38,'1B','L','L',{cL:45,cR:55,pL:55,pR:62,eye:52,ak:45,gap:55,spd:28,stl:3,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('mv-sp1','Etienne','Fortier',33,'L','L',{stuff:68,movement:72,control:70,stamina:72,velocity:90,hold_runners:60,groundball_pct:58,repertoire:['sinker','curveball','changeup','cutter']},28),
  mp('mv-sp2','Hugo','Desjardins',41,'R','R',{stuff:64,movement:68,control:66,stamina:70,velocity:91,hold_runners:55,groundball_pct:56,repertoire:['fastball','curveball','changeup','sinker']},30),
  mp('mv-sp3','Luc','Chartrand',49,'L','L',{stuff:62,movement:65,control:65,stamina:68,velocity:89,hold_runners:58,groundball_pct:60,repertoire:['sinker','changeup','curveball']},29),
  mp('mv-sp4','Marc','Gauthier',52,'R','R',{stuff:58,movement:62,control:64,stamina:66,velocity:90,hold_runners:52,groundball_pct:55,repertoire:['fastball','cutter','changeup','curveball']},27),
  mp('mv-sp5','Yves','Cloutier',37,'L','L',{stuff:55,movement:60,control:62,stamina:64,velocity:88,hold_runners:58,groundball_pct:60,repertoire:['sinker','changeup','curveball']},31),
  mp('mv-rp1','Bruno','Dufour',55,'R','R',{stuff:66,movement:68,control:62,stamina:42,velocity:94,hold_runners:52,groundball_pct:52,repertoire:['sinker','slider']}),
  mp('mv-rp2','Denis','Lambert',60,'L','L',{stuff:60,movement:65,control:62,stamina:48,velocity:90,hold_runners:58,groundball_pct:62,repertoire:['sinker','changeup','curveball']}),
  mp('mv-rp3','Alain','Pinard',45,'R','R',{stuff:68,movement:65,control:58,stamina:32,velocity:96,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('mv-rp4','Roger','Plante',63,'R','R',{stuff:55,movement:58,control:62,stamina:50,velocity:92,hold_runners:52,groundball_pct:55,repertoire:['sinker','cutter','changeup']}),
  mp('mv-rp5','Gilles','Martel',66,'L','L',{stuff:52,movement:60,control:58,stamina:45,velocity:89,hold_runners:55,groundball_pct:60,repertoire:['sinker','curveball']}),
  mp('mv-rp6','Roch','Simard',70,'R','R',{stuff:50,movement:55,control:58,stamina:48,velocity:91,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter']}),
  mp('mv-rp7','Leon','Guerin',73,'R','R',{stuff:48,movement:52,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:56,repertoire:['sinker','changeup']}),
];

// 19. Jacksonville Marlins — young, raw power, inconsistent
const jacksonvilleMarlinsPlayers: Player[] = [
  mb('jm-cf','Cam','Byrd',1,'CF','R','R',{cL:58,cR:62,pL:45,pR:52,eye:50,ak:45,gap:50,spd:80,stl:70,bnt:38,clt:45},{rng:82,arm:65,acc:65,dp:28,err:16},24),
  mb('jm-2b','Ricky','Soriano',4,'2B','S','R',{cL:58,cR:55,pL:35,pR:38,eye:55,ak:52,gap:42,spd:65,stl:50,bnt:48,clt:45},{rng:68,arm:50,acc:65,dp:70,err:22},23),
  mb('jm-ss','Deon','Tate',2,'SS','R','R',{cL:58,cR:62,pL:42,pR:48,eye:52,ak:48,gap:48,spd:72,stl:58,bnt:42,clt:48},{rng:75,arm:70,acc:68,dp:68,err:20},22),
  mb('jm-1b','Brick','Tanner',25,'1B','L','L',{cL:48,cR:60,pL:75,pR:82,eye:45,ak:35,gap:78,spd:28,stl:5,bnt:8,clt:55},{rng:50,arm:48,acc:55,dp:50,err:32},25),
  mb('jm-rf','Jaylen','Odom',33,'RF','R','R',{cL:52,cR:58,pL:68,pR:75,eye:45,ak:38,gap:70,spd:55,stl:30,bnt:15,clt:52},{rng:58,arm:75,acc:62,dp:28,err:25},24),
  mb('jm-dh','Leon','Vasquez',40,'DH','R','R',{cL:48,cR:55,pL:72,pR:78,eye:42,ak:35,gap:75,spd:28,stl:5,bnt:5,clt:58},{rng:20,arm:38,acc:38,dp:20,err:72},26),
  mb('jm-3b','Santos','Cruz',15,'3B','R','R',{cL:52,cR:58,pL:62,pR:68,eye:48,ak:42,gap:62,spd:45,stl:20,bnt:22,clt:52},{rng:62,arm:68,acc:60,dp:52,err:28},23),
  mb('jm-lf','Devin','Lake',22,'LF','L','R',{cL:50,cR:60,pL:58,pR:65,eye:48,ak:42,gap:60,spd:62,stl:45,bnt:22,clt:48},{rng:60,arm:55,acc:55,dp:25,err:28},24),
  mb('jm-c','Cruz','Medina',12,'C','R','R',{cL:48,cR:55,pL:48,pR:55,eye:50,ak:48,gap:50,spd:30,stl:8,bnt:20,clt:55},{rng:65,arm:70,acc:65,dp:42,err:24},25),
  mb('jm-bn1','Miles','York',9,'CF','R','R',{cL:45,cR:52,pL:38,pR:42,eye:45,ak:45,gap:42,spd:75,stl:62,bnt:38,clt:42},{rng:78,arm:60,acc:58,dp:25,err:18},22),
  mb('jm-bn2','Felix','Ibarra',6,'SS','R','R',{cL:50,cR:55,pL:30,pR:35,eye:48,ak:50,gap:35,spd:65,stl:50,bnt:45,clt:42},{rng:70,arm:62,acc:65,dp:65,err:22},23),
  mb('jm-bn3','Willy','Roth',36,'C','R','R',{cL:40,cR:48,pL:42,pR:48,eye:42,ak:42,gap:42,spd:25,stl:3,bnt:15,clt:48},{rng:60,arm:65,acc:58,dp:38,err:28},24),
  mb('jm-bn4','Bo','Key',38,'1B','L','L',{cL:42,cR:52,pL:62,pR:68,eye:40,ak:35,gap:60,spd:25,stl:3,bnt:5,clt:48},{rng:48,arm:42,acc:48,dp:45,err:35},25),
  mp('jm-sp1','Kelvin','Hyde',33,'R','R',{stuff:62,movement:60,control:56,stamina:70,velocity:96,hold_runners:45,groundball_pct:42,repertoire:['fastball','slider','changeup']},24),
  mp('jm-sp2','Raul','Corona',41,'R','R',{stuff:58,movement:56,control:55,stamina:68,velocity:94,hold_runners:48,groundball_pct:45,repertoire:['fastball','curveball','changeup']},23),
  mp('jm-sp3','Dex','Phelps',49,'L','L',{stuff:55,movement:55,control:52,stamina:66,velocity:92,hold_runners:50,groundball_pct:50,repertoire:['fastball','changeup','curveball']},22),
  mp('jm-sp4','Ty','Marsh',52,'R','R',{stuff:52,movement:52,control:55,stamina:64,velocity:93,hold_runners:45,groundball_pct:46,repertoire:['fastball','slider','changeup']},25),
  mp('jm-sp5','Beau','Crisp',37,'R','R',{stuff:50,movement:50,control:52,stamina:62,velocity:91,hold_runners:42,groundball_pct:48,repertoire:['fastball','cutter','curveball']},24),
  mp('jm-rp1','Duke','Sterling',55,'R','R',{stuff:64,movement:60,control:52,stamina:42,velocity:98,hold_runners:42,groundball_pct:35,repertoire:['fastball','slider']},23),
  mp('jm-rp2','Fern','Soto',60,'L','L',{stuff:55,movement:58,control:52,stamina:48,velocity:91,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup']},24),
  mp('jm-rp3','Ace','Golden',45,'R','R',{stuff:66,movement:62,control:48,stamina:30,velocity:100,hold_runners:40,groundball_pct:30,repertoire:['fastball','slider']},22),
  mp('jm-rp4','Ike','Norwood',63,'R','R',{stuff:52,movement:52,control:55,stamina:50,velocity:94,hold_runners:45,groundball_pct:45,repertoire:['fastball','cutter']},25),
  mp('jm-rp5','Hal','Bass',66,'L','L',{stuff:50,movement:55,control:50,stamina:45,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']},23),
  mp('jm-rp6','Skip','Penn',70,'R','R',{stuff:48,movement:48,control:52,stamina:48,velocity:93,hold_runners:42,groundball_pct:42,repertoire:['fastball','slider']},24),
  mp('jm-rp7','Juan','Leal',73,'R','R',{stuff:46,movement:48,control:55,stamina:50,velocity:91,hold_runners:48,groundball_pct:50,repertoire:['sinker','changeup']},22),
];

// 20. Raleigh Oaks — defense-first, patient at the plate
const raleighOaksPlayers: Player[] = [
  mb('ro-cf','Miles','Abbott',8,'CF','L','R',{cL:55,cR:65,pL:35,pR:40,eye:65,ak:62,gap:42,spd:80,stl:70,bnt:52,clt:52},{rng:88,arm:65,acc:68,dp:28,err:10}),
  mb('ro-2b','Glenn','Pruitt',4,'2B','R','R',{cL:62,cR:68,pL:28,pR:32,eye:68,ak:68,gap:35,spd:60,stl:45,bnt:60,clt:50},{rng:78,arm:55,acc:75,dp:82,err:12}),
  mb('ro-ss','Malik','Shepherd',2,'SS','R','R',{cL:60,cR:62,pL:35,pR:40,eye:60,ak:58,gap:40,spd:72,stl:60,bnt:52,clt:55},{rng:82,arm:72,acc:78,dp:75,err:12}),
  mb('ro-1b','Owen','Hartley',24,'1B','L','L',{cL:52,cR:62,pL:60,pR:68,eye:62,ak:52,gap:62,spd:30,stl:8,bnt:15,clt:58},{rng:58,arm:50,acc:62,dp:55,err:24}),
  mb('ro-rf','Corey','Flint',21,'RF','R','R',{cL:55,cR:60,pL:52,pR:58,eye:58,ak:52,gap:55,spd:52,stl:28,bnt:22,clt:55},{rng:68,arm:78,acc:72,dp:30,err:18}),
  mb('ro-dh','Hugo','Cantu',35,'DH','R','R',{cL:50,cR:58,pL:60,pR:68,eye:58,ak:48,gap:62,spd:28,stl:5,bnt:8,clt:60},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('ro-3b','Cole','Winslow',15,'3B','R','R',{cL:58,cR:62,pL:50,pR:55,eye:58,ak:55,gap:52,spd:42,stl:18,bnt:35,clt:58},{rng:72,arm:72,acc:70,dp:60,err:18}),
  mb('ro-lf','Toby','Ellis',17,'LF','L','R',{cL:50,cR:62,pL:48,pR:55,eye:58,ak:55,gap:52,spd:60,stl:42,bnt:30,clt:50},{rng:65,arm:58,acc:62,dp:28,err:22}),
  mb('ro-c','Wade','Plummer',12,'C','R','R',{cL:55,cR:60,pL:42,pR:48,eye:58,ak:58,gap:45,spd:28,stl:5,bnt:22,clt:62},{rng:75,arm:78,acc:75,dp:50,err:15}),
  mb('ro-bn1','Eli','Crane',9,'CF','R','R',{cL:48,cR:55,pL:28,pR:32,eye:55,ak:55,gap:32,spd:75,stl:62,bnt:50,clt:45},{rng:82,arm:60,acc:65,dp:25,err:12}),
  mb('ro-bn2','Ty','Blaine',6,'2B','L','R',{cL:52,cR:58,pL:25,pR:28,eye:62,ak:62,gap:28,spd:58,stl:42,bnt:58,clt:48},{rng:75,arm:50,acc:70,dp:78,err:15}),
  mb('ro-bn3','Mel','Swift',36,'C','R','R',{cL:42,cR:50,pL:38,pR:42,eye:52,ak:52,gap:38,spd:28,stl:5,bnt:18,clt:55},{rng:70,arm:72,acc:68,dp:45,err:18}),
  mb('ro-bn4','Van','Aldrich',38,'1B','L','L',{cL:45,cR:55,pL:52,pR:58,eye:55,ak:48,gap:52,spd:28,stl:3,bnt:12,clt:50},{rng:52,arm:48,acc:55,dp:52,err:28}),
  mp('ro-sp1','Clint','Sherwood',33,'R','R',{stuff:66,movement:66,control:68,stamina:72,velocity:92,hold_runners:55,groundball_pct:55,repertoire:['sinker','slider','changeup','curveball']},28),
  mp('ro-sp2','Jack','Mabry',41,'L','L',{stuff:62,movement:64,control:66,stamina:70,velocity:90,hold_runners:58,groundball_pct:58,repertoire:['sinker','changeup','curveball']},30),
  mp('ro-sp3','Dale','Kershaw',49,'R','R',{stuff:60,movement:62,control:64,stamina:68,velocity:91,hold_runners:52,groundball_pct:52,repertoire:['fastball','cutter','changeup']},27),
  mp('ro-sp4','Hal','Winters',52,'R','R',{stuff:56,movement:58,control:62,stamina:66,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','slider','changeup']},29),
  mp('ro-sp5','Len','Doyle',37,'L','L',{stuff:54,movement:56,control:62,stamina:64,velocity:88,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup','curveball']},31),
  mp('ro-rp1','Wade','Givens',55,'R','R',{stuff:66,movement:64,control:62,stamina:44,velocity:95,hold_runners:52,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('ro-rp2','Cal','Meade',60,'L','L',{stuff:58,movement:62,control:60,stamina:48,velocity:90,hold_runners:55,groundball_pct:60,repertoire:['sinker','changeup']}),
  mp('ro-rp3','Jed','Qualls',45,'R','R',{stuff:68,movement:65,control:55,stamina:32,velocity:97,hold_runners:45,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('ro-rp4','Vern','Lott',63,'R','R',{stuff:55,movement:56,control:62,stamina:50,velocity:92,hold_runners:52,groundball_pct:55,repertoire:['sinker','cutter','changeup']}),
  mp('ro-rp5','Sam','Nye',66,'L','L',{stuff:52,movement:58,control:58,stamina:45,velocity:89,hold_runners:55,groundball_pct:60,repertoire:['sinker','curveball']}),
  mp('ro-rp6','Roy','Ash',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:91,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter']}),
  mp('ro-rp7','Gil','Dunn',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:56,repertoire:['sinker','changeup','cutter']}),
];


// ═══════════════════════════════════════════════════════════
// NATIONAL LEAGUE CENTRAL
// ═══════════════════════════════════════════════════════════

// 21. San Antonio Missions — power arms + big bats, old-school
const sanAntonioMissionsPlayers: Player[] = [
  mb('sam-cf','Jesse','Villarreal',8,'CF','R','R',{cL:60,cR:64,pL:45,pR:50,eye:55,ak:52,gap:48,spd:78,stl:65,bnt:42,clt:52},{rng:82,arm:65,acc:65,dp:28,err:14}),
  mb('sam-2b','Bobby','Cortez',4,'2B','R','R',{cL:62,cR:66,pL:35,pR:42,eye:58,ak:55,gap:45,spd:62,stl:48,bnt:52,clt:50},{rng:72,arm:52,acc:68,dp:72,err:18}),
  mb('sam-ss','Rey','Sandoval',2,'SS','R','R',{cL:60,cR:65,pL:40,pR:45,eye:58,ak:55,gap:48,spd:70,stl:58,bnt:48,clt:55},{rng:78,arm:72,acc:72,dp:72,err:16}),
  mb('sam-1b','Ox','Bautista',25,'1B','R','R',{cL:50,cR:58,pL:78,pR:85,eye:48,ak:38,gap:80,spd:25,stl:3,bnt:5,clt:68},{rng:48,arm:48,acc:55,dp:50,err:32}),
  mb('sam-rf','Lupe','Garza',33,'RF','R','R',{cL:58,cR:65,pL:65,pR:72,eye:52,ak:45,gap:68,spd:48,stl:20,bnt:15,clt:62},{rng:58,arm:75,acc:65,dp:28,err:25}),
  mb('sam-dh','Big','Fuentes',40,'DH','R','R',{cL:48,cR:58,pL:80,pR:88,eye:45,ak:35,gap:82,spd:22,stl:2,bnt:5,clt:72},{rng:20,arm:35,acc:35,dp:20,err:78}),
  mb('sam-3b','Tomas','Luna',15,'3B','R','R',{cL:55,cR:60,pL:68,pR:72,eye:50,ak:45,gap:68,spd:38,stl:15,bnt:22,clt:62},{rng:65,arm:72,acc:62,dp:52,err:26}),
  mb('sam-lf','Emilio','Montes',22,'LF','L','R',{cL:52,cR:62,pL:58,pR:65,eye:52,ak:45,gap:62,spd:55,stl:35,bnt:20,clt:52},{rng:58,arm:55,acc:55,dp:25,err:28}),
  mb('sam-c','Rudy','Canales',12,'C','R','R',{cL:52,cR:58,pL:52,pR:58,eye:52,ak:48,gap:55,spd:28,stl:5,bnt:18,clt:60},{rng:68,arm:72,acc:68,dp:45,err:22}),
  mb('sam-bn1','Cisco','Pena',9,'LF','L','R',{cL:48,cR:58,pL:52,pR:58,eye:48,ak:42,gap:55,spd:52,stl:32,bnt:18,clt:48},{rng:55,arm:52,acc:52,dp:25,err:30}),
  mb('sam-bn2','Mando','Rios',6,'2B','R','R',{cL:52,cR:58,pL:28,pR:32,eye:52,ak:55,gap:32,spd:58,stl:42,bnt:50,clt:45},{rng:68,arm:48,acc:65,dp:70,err:22}),
  mb('sam-bn3','Gil','Torres',36,'C','R','R',{cL:42,cR:50,pL:48,pR:52,eye:45,ak:42,gap:48,spd:25,stl:3,bnt:15,clt:55},{rng:62,arm:68,acc:62,dp:40,err:25}),
  mb('sam-bn4','Chuy','Deleon',38,'1B','L','L',{cL:45,cR:55,pL:65,pR:70,eye:42,ak:35,gap:62,spd:25,stl:3,bnt:5,clt:52},{rng:48,arm:42,acc:48,dp:45,err:35}),
  mp('sam-sp1','Rigo','Navarro',33,'R','R',{stuff:70,movement:68,control:64,stamina:74,velocity:96,hold_runners:52,groundball_pct:45,repertoire:['fastball','slider','changeup','curveball']},29),
  mp('sam-sp2','Paco','Ibarra',41,'L','L',{stuff:65,movement:68,control:62,stamina:70,velocity:92,hold_runners:58,groundball_pct:58,repertoire:['sinker','curveball','changeup']},28),
  mp('sam-sp3','Jorge','Estrada',49,'R','R',{stuff:62,movement:62,control:60,stamina:68,velocity:94,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider','changeup']},27),
  mp('sam-sp4','Memo','Salazar',52,'R','R',{stuff:58,movement:60,control:60,stamina:66,velocity:93,hold_runners:50,groundball_pct:50,repertoire:['fastball','cutter','curveball']},30),
  mp('sam-sp5','Beto','Quiroz',37,'L','L',{stuff:55,movement:58,control:58,stamina:64,velocity:90,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup','curveball']},31),
  mp('sam-rp1','Chico','Reyes',55,'R','R',{stuff:68,movement:65,control:58,stamina:42,velocity:98,hold_runners:48,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('sam-rp2','Lalo','Mendez',60,'L','L',{stuff:60,movement:62,control:58,stamina:48,velocity:91,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('sam-rp3','Pedro','Vargas',45,'R','R',{stuff:72,movement:70,control:52,stamina:32,velocity:100,hold_runners:42,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('sam-rp4','Nacho','Acosta',63,'R','R',{stuff:56,movement:55,control:60,stamina:50,velocity:94,hold_runners:50,groundball_pct:50,repertoire:['fastball','cutter','changeup']}),
  mp('sam-rp5','Hugo','Zapata',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:90,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('sam-rp6','Toby','Ramos',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('sam-rp7','Nico','Ponce',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:91,hold_runners:50,groundball_pct:52,repertoire:['sinker','changeup']}),
];

// 22. New Orleans Crawdads — fun, aggressive, high-energy
const newOrleansCrawdadsPlayers: Player[] = [
  mb('noc-cf','Antoine','Boudreaux',1,'CF','S','R',{cL:62,cR:60,pL:42,pR:45,eye:55,ak:50,gap:48,spd:85,stl:78,bnt:48,clt:50},{rng:85,arm:62,acc:65,dp:28,err:12}),
  mb('noc-2b','Remy','Fontenot',4,'2B','L','R',{cL:60,cR:68,pL:32,pR:38,eye:58,ak:55,gap:42,spd:65,stl:52,bnt:52,clt:48},{rng:70,arm:50,acc:68,dp:72,err:20}),
  mb('noc-ss','Dante','Broussard',2,'SS','R','R',{cL:62,cR:68,pL:42,pR:48,eye:55,ak:52,gap:50,spd:72,stl:62,bnt:45,clt:55},{rng:76,arm:70,acc:70,dp:70,err:16}),
  mb('noc-1b','Leon','Thibodeaux',25,'1B','L','L',{cL:52,cR:65,pL:70,pR:78,eye:52,ak:45,gap:72,spd:28,stl:5,bnt:8,clt:60},{rng:52,arm:48,acc:55,dp:50,err:30}),
  mb('noc-rf','Gator','Landry',33,'RF','R','R',{cL:58,cR:65,pL:65,pR:72,eye:50,ak:42,gap:68,spd:55,stl:32,bnt:15,clt:62},{rng:60,arm:75,acc:65,dp:28,err:24}),
  mb('noc-dh','Bubba','Arceneaux',40,'DH','R','R',{cL:50,cR:60,pL:72,pR:80,eye:48,ak:38,gap:75,spd:28,stl:5,bnt:5,clt:68},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('noc-3b','Mack','Guidry',15,'3B','R','R',{cL:58,cR:62,pL:60,pR:68,eye:50,ak:45,gap:62,spd:45,stl:22,bnt:25,clt:58},{rng:65,arm:70,acc:62,dp:52,err:25}),
  mb('noc-lf','Tre','Hebert',22,'LF','L','R',{cL:52,cR:62,pL:55,pR:62,eye:52,ak:48,gap:58,spd:65,stl:50,bnt:22,clt:50},{rng:62,arm:58,acc:58,dp:28,err:26}),
  mb('noc-c','Pierre','LeBlanc',12,'C','R','R',{cL:50,cR:58,pL:48,pR:55,eye:52,ak:50,gap:52,spd:30,stl:8,bnt:20,clt:58},{rng:65,arm:70,acc:65,dp:42,err:22}),
  mb('noc-bn1','Roux','Melancon',9,'CF','R','R',{cL:48,cR:55,pL:35,pR:40,eye:48,ak:48,gap:40,spd:78,stl:65,bnt:42,clt:42},{rng:80,arm:58,acc:60,dp:25,err:16}),
  mb('noc-bn2','Beau','Prejean',6,'SS','R','R',{cL:52,cR:58,pL:30,pR:35,eye:50,ak:52,gap:38,spd:65,stl:52,bnt:48,clt:45},{rng:72,arm:62,acc:65,dp:68,err:20}),
  mb('noc-bn3','Caj','Daigle',36,'C','R','R',{cL:42,cR:48,pL:42,pR:48,eye:45,ak:45,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:60,arm:65,acc:60,dp:38,err:25}),
  mb('noc-bn4','Remy','Boudreaux',38,'1B','L','L',{cL:45,cR:52,pL:60,pR:65,eye:45,ak:38,gap:58,spd:25,stl:3,bnt:5,clt:50},{rng:48,arm:42,acc:48,dp:45,err:32}),
  mp('noc-sp1','Beau','Gervais',33,'R','R',{stuff:65,movement:62,control:62,stamina:72,velocity:94,hold_runners:50,groundball_pct:48,repertoire:['fastball','slider','changeup','curveball']},28),
  mp('noc-sp2','Rene','Mouton',41,'L','L',{stuff:60,movement:62,control:60,stamina:70,velocity:91,hold_runners:55,groundball_pct:55,repertoire:['sinker','changeup','curveball']},29),
  mp('noc-sp3','Gaston','Breaux',49,'R','R',{stuff:58,movement:60,control:58,stamina:68,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider','changeup']},27),
  mp('noc-sp4','Alton','Castille',52,'R','R',{stuff:55,movement:58,control:58,stamina:66,velocity:92,hold_runners:48,groundball_pct:52,repertoire:['fastball','cutter','changeup']},30),
  mp('noc-sp5','Claude','Dugas',37,'L','L',{stuff:52,movement:55,control:58,stamina:64,velocity:89,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup','curveball']},31),
  mp('noc-rp1','Beau','Richard',55,'R','R',{stuff:66,movement:62,control:58,stamina:42,velocity:97,hold_runners:48,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('noc-rp2','Luc','Mire',60,'L','L',{stuff:58,movement:60,control:55,stamina:48,velocity:91,hold_runners:52,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('noc-rp3','Tee','Babineaux',45,'R','R',{stuff:70,movement:65,control:52,stamina:30,velocity:99,hold_runners:42,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('noc-rp4','Sid','Toups',63,'R','R',{stuff:55,movement:55,control:58,stamina:50,velocity:93,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter']}),
  mp('noc-rp5','Trey','Comeaux',66,'L','L',{stuff:52,movement:55,control:55,stamina:45,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('noc-rp6','Blaine','Savoy',70,'R','R',{stuff:50,movement:52,control:55,stamina:48,velocity:93,hold_runners:45,groundball_pct:45,repertoire:['fastball','slider']}),
  mp('noc-rp7','Guy','Trosclair',73,'R','R',{stuff:48,movement:50,control:58,stamina:50,velocity:91,hold_runners:48,groundball_pct:52,repertoire:['sinker','changeup']}),
];

// 23. Oklahoma City Wranglers — balanced, mid-tier
const okcWranglersPlayers: Player[] = [
  mb('okc-cf','Ty','McReynolds',8,'CF','R','R',{cL:60,cR:64,pL:42,pR:48,eye:55,ak:52,gap:48,spd:75,stl:62,bnt:42,clt:50},{rng:80,arm:62,acc:65,dp:28,err:16}),
  mb('okc-2b','Danny','Wise',4,'2B','R','R',{cL:60,cR:65,pL:35,pR:40,eye:58,ak:55,gap:42,spd:60,stl:45,bnt:52,clt:48},{rng:70,arm:52,acc:68,dp:72,err:20}),
  mb('okc-ss','Colt','Hardin',2,'SS','R','R',{cL:58,cR:62,pL:42,pR:48,eye:55,ak:52,gap:48,spd:68,stl:55,bnt:45,clt:52},{rng:75,arm:70,acc:68,dp:68,err:18}),
  mb('okc-1b','Ridge','Clayton',24,'1B','L','L',{cL:52,cR:65,pL:68,pR:75,eye:55,ak:48,gap:70,spd:28,stl:5,bnt:10,clt:58},{rng:52,arm:48,acc:55,dp:50,err:28}),
  mb('okc-rf','Blake','Stockton',21,'RF','R','R',{cL:58,cR:62,pL:60,pR:68,eye:52,ak:48,gap:62,spd:50,stl:22,bnt:18,clt:55},{rng:60,arm:72,acc:62,dp:28,err:25}),
  mb('okc-dh','Jake','Ponder',35,'DH','R','R',{cL:50,cR:58,pL:68,pR:75,eye:50,ak:42,gap:70,spd:28,stl:5,bnt:8,clt:62},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('okc-3b','Brice','Tatum',15,'3B','R','R',{cL:58,cR:62,pL:58,pR:65,eye:52,ak:48,gap:60,spd:42,stl:18,bnt:28,clt:58},{rng:65,arm:70,acc:62,dp:52,err:25}),
  mb('okc-lf','Skip','Wyatt',17,'LF','L','R',{cL:52,cR:62,pL:55,pR:62,eye:52,ak:48,gap:58,spd:58,stl:38,bnt:22,clt:50},{rng:60,arm:55,acc:55,dp:25,err:28}),
  mb('okc-c','Clint','Hobbs',12,'C','R','R',{cL:52,cR:58,pL:48,pR:55,eye:52,ak:50,gap:52,spd:30,stl:8,bnt:20,clt:58},{rng:65,arm:70,acc:65,dp:42,err:22}),
  mb('okc-bn1','Wes','Pryor',9,'CF','R','R',{cL:48,cR:55,pL:32,pR:38,eye:48,ak:50,gap:38,spd:72,stl:58,bnt:42,clt:42},{rng:78,arm:58,acc:60,dp:25,err:16}),
  mb('okc-bn2','Les','Cain',6,'SS','R','R',{cL:52,cR:55,pL:28,pR:32,eye:52,ak:52,gap:35,spd:65,stl:48,bnt:48,clt:45},{rng:72,arm:62,acc:65,dp:68,err:20}),
  mb('okc-bn3','Rod','Sprague',36,'C','R','R',{cL:42,cR:48,pL:42,pR:48,eye:45,ak:45,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:60,arm:68,acc:60,dp:38,err:25}),
  mb('okc-bn4','Don','Baskin',38,'1B','R','R',{cL:45,cR:52,pL:60,pR:65,eye:45,ak:40,gap:58,spd:28,stl:3,bnt:8,clt:50},{rng:48,arm:45,acc:50,dp:48,err:32}),
  mp('okc-sp1','Cal','Buchanan',33,'R','R',{stuff:64,movement:62,control:64,stamina:72,velocity:93,hold_runners:52,groundball_pct:50,repertoire:['fastball','slider','changeup','curveball']},28),
  mp('okc-sp2','Dub','Pearson',41,'L','L',{stuff:60,movement:60,control:62,stamina:70,velocity:91,hold_runners:55,groundball_pct:54,repertoire:['sinker','curveball','changeup']},30),
  mp('okc-sp3','Chad','Redding',49,'R','R',{stuff:58,movement:58,control:60,stamina:68,velocity:92,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter','changeup']},27),
  mp('okc-sp4','Lane','Scoggins',52,'R','R',{stuff:55,movement:56,control:60,stamina:66,velocity:91,hold_runners:50,groundball_pct:52,repertoire:['fastball','slider','changeup']},29),
  mp('okc-sp5','Earl','Tidwell',37,'L','L',{stuff:52,movement:55,control:58,stamina:64,velocity:89,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup','curveball']},31),
  mp('okc-rp1','Buck','Alderman',55,'R','R',{stuff:64,movement:60,control:58,stamina:42,velocity:96,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('okc-rp2','Slim','Crabtree',60,'L','L',{stuff:56,movement:58,control:55,stamina:48,velocity:90,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup']}),
  mp('okc-rp3','Ace','Howell',45,'R','R',{stuff:68,movement:62,control:52,stamina:30,velocity:98,hold_runners:42,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('okc-rp4','Gene','Ratliff',63,'R','R',{stuff:54,movement:52,control:58,stamina:50,velocity:93,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter']}),
  mp('okc-rp5','Ned','Bowden',66,'L','L',{stuff:50,movement:55,control:55,stamina:45,velocity:89,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('okc-rp6','Ike','Pruitt',70,'R','R',{stuff:48,movement:50,control:55,stamina:48,velocity:92,hold_runners:45,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('okc-rp7','Red','Cantrell',73,'R','R',{stuff:46,movement:48,control:58,stamina:50,velocity:90,hold_runners:48,groundball_pct:52,repertoire:['sinker','changeup']}),
];

// 24. Birmingham Barons — strong bullpen, scrappy offense
const birminghamBaronsPlayers: Player[] = [
  mb('bb-cf','Willie','Crowe',8,'CF','L','R',{cL:55,cR:65,pL:35,pR:40,eye:58,ak:55,gap:42,spd:78,stl:68,bnt:52,clt:50},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('bb-2b','Seth','Rigsby',4,'2B','R','R',{cL:62,cR:66,pL:28,pR:32,eye:62,ak:62,gap:35,spd:60,stl:45,bnt:58,clt:48},{rng:75,arm:52,acc:72,dp:78,err:16}),
  mb('bb-ss','Deke','Hollis',2,'SS','R','R',{cL:60,cR:62,pL:35,pR:40,eye:58,ak:55,gap:40,spd:68,stl:55,bnt:50,clt:52},{rng:78,arm:70,acc:72,dp:72,err:16}),
  mb('bb-1b','Nash','Poole',24,'1B','L','L',{cL:52,cR:62,pL:62,pR:70,eye:55,ak:48,gap:65,spd:28,stl:5,bnt:10,clt:55},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('bb-rf','Ash','Pickett',21,'RF','R','R',{cL:55,cR:60,pL:55,pR:62,eye:52,ak:48,gap:58,spd:52,stl:25,bnt:20,clt:55},{rng:62,arm:72,acc:65,dp:28,err:24}),
  mb('bb-dh','Clay','Boggs',35,'DH','R','R',{cL:50,cR:58,pL:62,pR:68,eye:52,ak:45,gap:65,spd:28,stl:5,bnt:8,clt:60},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('bb-3b','Hank','Vickers',15,'3B','R','R',{cL:58,cR:62,pL:52,pR:58,eye:55,ak:52,gap:55,spd:42,stl:18,bnt:30,clt:55},{rng:68,arm:68,acc:65,dp:55,err:22}),
  mb('bb-lf','Otis','Spivey',17,'LF','L','R',{cL:50,cR:62,pL:48,pR:55,eye:55,ak:52,gap:52,spd:58,stl:42,bnt:28,clt:48},{rng:62,arm:55,acc:58,dp:28,err:28}),
  mb('bb-c','Earl','Scruggs',12,'C','R','R',{cL:52,cR:58,pL:45,pR:52,eye:55,ak:52,gap:48,spd:28,stl:5,bnt:20,clt:58},{rng:68,arm:72,acc:70,dp:48,err:20}),
  mb('bb-bn1','Ty','Cato',9,'CF','R','R',{cL:48,cR:55,pL:28,pR:32,eye:52,ak:52,gap:32,spd:72,stl:60,bnt:48,clt:42},{rng:78,arm:58,acc:60,dp:25,err:16}),
  mb('bb-bn2','Lee','Stamps',6,'2B','L','R',{cL:52,cR:58,pL:25,pR:28,eye:58,ak:58,gap:28,spd:58,stl:42,bnt:55,clt:45},{rng:72,arm:48,acc:68,dp:75,err:18}),
  mb('bb-bn3','Griff','Teal',36,'C','R','R',{cL:42,cR:48,pL:40,pR:45,eye:50,ak:50,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:65,arm:68,acc:62,dp:42,err:22}),
  mb('bb-bn4','Al','Spann',38,'1B','R','R',{cL:45,cR:52,pL:55,pR:60,eye:48,ak:42,gap:52,spd:28,stl:3,bnt:8,clt:48},{rng:50,arm:45,acc:50,dp:48,err:30}),
  mp('bb-sp1','Hoss','Gatlin',33,'R','R',{stuff:64,movement:62,control:64,stamina:72,velocity:93,hold_runners:52,groundball_pct:52,repertoire:['fastball','slider','changeup','curveball']},29),
  mp('bb-sp2','Watt','Loftin',41,'L','L',{stuff:60,movement:62,control:62,stamina:70,velocity:90,hold_runners:55,groundball_pct:56,repertoire:['sinker','curveball','changeup']},30),
  mp('bb-sp3','Stew','Norwood',49,'R','R',{stuff:56,movement:58,control:60,stamina:68,velocity:91,hold_runners:48,groundball_pct:52,repertoire:['fastball','cutter','changeup']},27),
  mp('bb-sp4','Judd','Autry',52,'R','R',{stuff:54,movement:56,control:60,stamina:66,velocity:90,hold_runners:50,groundball_pct:54,repertoire:['sinker','slider','changeup']},28),
  mp('bb-sp5','Mose','Tribble',37,'L','L',{stuff:52,movement:54,control:58,stamina:64,velocity:88,hold_runners:52,groundball_pct:58,repertoire:['sinker','changeup','curveball']},31),
  mp('bb-rp1','Rube','Harkey',55,'R','R',{stuff:72,movement:70,control:65,stamina:44,velocity:97,hold_runners:52,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('bb-rp2','Floyd','Tuggle',60,'L','L',{stuff:65,movement:68,control:62,stamina:48,velocity:91,hold_runners:58,groundball_pct:60,repertoire:['sinker','changeup','curveball']}),
  mp('bb-rp3','Bo','Hargrove',45,'R','R',{stuff:75,movement:72,control:58,stamina:32,velocity:99,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('bb-rp4','Nub','Farley',63,'R','R',{stuff:62,movement:60,control:62,stamina:50,velocity:94,hold_runners:52,groundball_pct:50,repertoire:['fastball','cutter','changeup']}),
  mp('bb-rp5','Roy','Chitwood',66,'L','L',{stuff:58,movement:62,control:58,stamina:45,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('bb-rp6','Gus','Lanier',70,'R','R',{stuff:55,movement:55,control:60,stamina:48,velocity:93,hold_runners:50,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('bb-rp7','Lew','Petty',73,'R','R',{stuff:52,movement:52,control:62,stamina:50,velocity:91,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// 25. Tulsa Drillers — average across the board, reliable
const tulsaDrillersPlayers: Player[] = [
  mb('td-cf','Zane','McCord',8,'CF','R','R',{cL:60,cR:62,pL:42,pR:48,eye:55,ak:52,gap:48,spd:75,stl:62,bnt:42,clt:50},{rng:80,arm:62,acc:65,dp:28,err:16}),
  mb('td-2b','Roy','Pittman',4,'2B','R','R',{cL:60,cR:64,pL:32,pR:38,eye:58,ak:58,gap:40,spd:60,stl:45,bnt:52,clt:50},{rng:72,arm:52,acc:70,dp:75,err:18}),
  mb('td-ss','Dion','Black',2,'SS','S','R',{cL:58,cR:56,pL:38,pR:42,eye:55,ak:52,gap:42,spd:68,stl:55,bnt:48,clt:52},{rng:76,arm:68,acc:70,dp:70,err:18}),
  mb('td-1b','Ray','Pruitt',24,'1B','L','L',{cL:52,cR:64,pL:65,pR:72,eye:55,ak:48,gap:68,spd:28,stl:5,bnt:10,clt:55},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('td-rf','Bo','Millsap',21,'RF','R','R',{cL:58,cR:62,pL:58,pR:65,eye:52,ak:48,gap:60,spd:50,stl:22,bnt:18,clt:55},{rng:60,arm:72,acc:62,dp:28,err:25}),
  mb('td-dh','Hank','Whitten',35,'DH','R','R',{cL:50,cR:58,pL:65,pR:72,eye:50,ak:42,gap:68,spd:28,stl:5,bnt:8,clt:60},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('td-3b','Buck','Ladd',15,'3B','R','R',{cL:56,cR:60,pL:55,pR:62,eye:52,ak:48,gap:58,spd:42,stl:18,bnt:28,clt:55},{rng:66,arm:68,acc:62,dp:52,err:24}),
  mb('td-lf','Neil','Riggs',17,'LF','L','R',{cL:50,cR:60,pL:52,pR:58,eye:52,ak:48,gap:55,spd:58,stl:40,bnt:25,clt:48},{rng:60,arm:55,acc:55,dp:25,err:28}),
  mb('td-c','Bart','Hicks',12,'C','R','R',{cL:50,cR:56,pL:48,pR:52,eye:52,ak:50,gap:48,spd:28,stl:5,bnt:20,clt:55},{rng:66,arm:70,acc:68,dp:45,err:22}),
  mb('td-bn1','Arlen','Dodd',9,'LF','R','R',{cL:48,cR:55,pL:45,pR:52,eye:48,ak:48,gap:48,spd:55,stl:35,bnt:25,clt:45},{rng:58,arm:52,acc:55,dp:25,err:28}),
  mb('td-bn2','Curt','Estes',6,'2B','R','R',{cL:52,cR:58,pL:28,pR:32,eye:52,ak:55,gap:32,spd:58,stl:42,bnt:50,clt:45},{rng:68,arm:48,acc:65,dp:70,err:20}),
  mb('td-bn3','Duane','Cope',36,'C','R','R',{cL:42,cR:48,pL:42,pR:48,eye:48,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:62,arm:68,acc:62,dp:40,err:25}),
  mb('td-bn4','Lon','Creech',38,'1B','L','L',{cL:45,cR:52,pL:58,pR:62,eye:48,ak:42,gap:55,spd:28,stl:3,bnt:8,clt:48},{rng:50,arm:45,acc:50,dp:48,err:30}),
  mp('td-sp1','Ace','Newberry',33,'R','R',{stuff:62,movement:60,control:62,stamina:70,velocity:93,hold_runners:50,groundball_pct:50,repertoire:['fastball','slider','changeup','curveball']},28),
  mp('td-sp2','Cy','Rayburn',41,'L','L',{stuff:58,movement:60,control:60,stamina:68,velocity:91,hold_runners:52,groundball_pct:54,repertoire:['sinker','curveball','changeup']},30),
  mp('td-sp3','Webb','Grimes',49,'R','R',{stuff:56,movement:58,control:58,stamina:66,velocity:92,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter','changeup']},27),
  mp('td-sp4','Cobb','Early',52,'R','R',{stuff:54,movement:55,control:60,stamina:64,velocity:90,hold_runners:50,groundball_pct:52,repertoire:['sinker','slider','changeup']},29),
  mp('td-sp5','Slim','Tugwell',37,'L','L',{stuff:52,movement:52,control:58,stamina:62,velocity:89,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup','curveball']},31),
  mp('td-rp1','Link','Fowler',55,'R','R',{stuff:64,movement:60,control:58,stamina:42,velocity:96,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('td-rp2','Rube','Clifton',60,'L','L',{stuff:56,movement:60,control:55,stamina:48,velocity:90,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup']}),
  mp('td-rp3','Grit','Yancey',45,'R','R',{stuff:66,movement:62,control:52,stamina:30,velocity:98,hold_runners:42,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('td-rp4','Jeb','Counts',63,'R','R',{stuff:54,movement:52,control:58,stamina:50,velocity:93,hold_runners:48,groundball_pct:50,repertoire:['fastball','cutter']}),
  mp('td-rp5','Clem','Ogle',66,'L','L',{stuff:50,movement:55,control:55,stamina:45,velocity:89,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('td-rp6','Dutch','Henley',70,'R','R',{stuff:48,movement:50,control:55,stamina:48,velocity:92,hold_runners:45,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('td-rp7','Cass','Tidwell',73,'R','R',{stuff:46,movement:48,control:58,stamina:50,velocity:90,hold_runners:48,groundball_pct:52,repertoire:['sinker','changeup']}),
];


// ═══════════════════════════════════════════════════════════
// NATIONAL LEAGUE WEST
// ═══════════════════════════════════════════════════════════

// 26. Vancouver Peaks — elite pitching, cold-weather team
const vancouverPeaksPlayers: Player[] = [
  mb('vp-cf','Jin','Park',1,'CF','L','R',{cL:55,cR:65,pL:35,pR:40,eye:62,ak:60,gap:42,spd:80,stl:72,bnt:52,clt:50},{rng:85,arm:65,acc:68,dp:28,err:10}),
  mb('vp-2b','Liam','Ashe',4,'2B','R','R',{cL:60,cR:65,pL:28,pR:32,eye:65,ak:65,gap:35,spd:60,stl:45,bnt:58,clt:48},{rng:76,arm:52,acc:72,dp:78,err:15}),
  mb('vp-ss','Noah','Kwan',2,'SS','L','R',{cL:58,cR:65,pL:35,pR:40,eye:62,ak:60,gap:42,spd:72,stl:60,bnt:52,clt:55},{rng:80,arm:70,acc:75,dp:74,err:14}),
  mb('vp-1b','Finn','Gallagher',24,'1B','L','L',{cL:50,cR:60,pL:58,pR:65,eye:58,ak:50,gap:60,spd:30,stl:8,bnt:12,clt:55},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('vp-rf','Scott','Maguire',21,'RF','R','R',{cL:55,cR:60,pL:52,pR:58,eye:55,ak:50,gap:55,spd:50,stl:22,bnt:20,clt:52},{rng:62,arm:72,acc:65,dp:28,err:22}),
  mb('vp-dh','Russ','Bellamy',35,'DH','R','R',{cL:48,cR:56,pL:60,pR:68,eye:52,ak:45,gap:62,spd:28,stl:5,bnt:8,clt:58},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('vp-3b','Kurt','Albright',15,'3B','R','R',{cL:55,cR:60,pL:50,pR:55,eye:55,ak:52,gap:52,spd:42,stl:18,bnt:32,clt:52},{rng:70,arm:70,acc:68,dp:58,err:20}),
  mb('vp-lf','Kai','Larsen',17,'LF','L','R',{cL:50,cR:60,pL:45,pR:52,eye:55,ak:52,gap:48,spd:60,stl:45,bnt:28,clt:48},{rng:62,arm:55,acc:58,dp:28,err:26}),
  mb('vp-c','Ian','McLeod',12,'C','R','R',{cL:52,cR:58,pL:42,pR:48,eye:55,ak:55,gap:45,spd:28,stl:5,bnt:20,clt:60},{rng:72,arm:78,acc:75,dp:50,err:15}),
  mb('vp-bn1','Ty','Cheng',9,'CF','L','R',{cL:45,cR:55,pL:28,pR:32,eye:52,ak:55,gap:32,spd:75,stl:65,bnt:50,clt:42},{rng:82,arm:58,acc:62,dp:25,err:12}),
  mb('vp-bn2','Ewan','Ross',6,'SS','R','R',{cL:50,cR:55,pL:28,pR:32,eye:52,ak:55,gap:32,spd:65,stl:50,bnt:52,clt:45},{rng:75,arm:65,acc:68,dp:70,err:16}),
  mb('vp-bn3','Nils','Berg',36,'C','R','R',{cL:42,cR:48,pL:38,pR:42,eye:50,ak:50,gap:38,spd:28,stl:5,bnt:18,clt:52},{rng:68,arm:72,acc:68,dp:45,err:18}),
  mb('vp-bn4','Ted','Hoyt',38,'1B','L','L',{cL:42,cR:52,pL:52,pR:58,eye:50,ak:45,gap:52,spd:28,stl:3,bnt:10,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('vp-sp1','Dag','Ericsson',33,'L','L',{stuff:76,movement:74,control:72,stamina:76,velocity:94,hold_runners:62,groundball_pct:55,repertoire:['fastball','curveball','changeup','sinker']},27),
  mp('vp-sp2','Cole','Thurston',41,'R','R',{stuff:72,movement:70,control:68,stamina:74,velocity:95,hold_runners:55,groundball_pct:48,repertoire:['fastball','slider','changeup','curveball']},28),
  mp('vp-sp3','Nate','Lindqvist',49,'L','L',{stuff:66,movement:68,control:66,stamina:70,velocity:91,hold_runners:58,groundball_pct:58,repertoire:['sinker','curveball','changeup']},29),
  mp('vp-sp4','Erik','Strand',52,'R','R',{stuff:62,movement:64,control:64,stamina:68,velocity:92,hold_runners:52,groundball_pct:52,repertoire:['fastball','slider','changeup','cutter']},26),
  mp('vp-sp5','Lars','Nyquist',37,'L','L',{stuff:58,movement:62,control:64,stamina:66,velocity:90,hold_runners:58,groundball_pct:60,repertoire:['sinker','changeup','curveball']},30),
  mp('vp-rp1','Sven','Borg',55,'R','R',{stuff:72,movement:70,control:66,stamina:42,velocity:97,hold_runners:52,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('vp-rp2','Pierre','Lacroix',60,'L','L',{stuff:64,movement:68,control:62,stamina:48,velocity:91,hold_runners:58,groundball_pct:62,repertoire:['sinker','changeup','curveball']}),
  mp('vp-rp3','Axel','Holm',45,'R','R',{stuff:74,movement:72,control:58,stamina:32,velocity:99,hold_runners:48,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('vp-rp4','Grant','Forsyth',63,'R','R',{stuff:60,movement:58,control:62,stamina:50,velocity:94,hold_runners:52,groundball_pct:50,repertoire:['fastball','cutter','changeup']}),
  mp('vp-rp5','Rory','MacNeil',66,'L','L',{stuff:56,movement:62,control:58,stamina:45,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('vp-rp6','Miles','Fenn',70,'R','R',{stuff:54,movement:55,control:58,stamina:48,velocity:93,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('vp-rp7','Cal','Irvine',73,'R','R',{stuff:52,movement:52,control:62,stamina:50,velocity:91,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// 27. Honolulu Sharks — high-energy, speed & contact
const honoluluSharksPlayers: Player[] = [
  mb('hs-cf','Kai','Kealoha',1,'CF','S','R',{cL:68,cR:65,pL:35,pR:38,eye:60,ak:58,gap:42,spd:88,stl:82,bnt:58,clt:48},{rng:90,arm:62,acc:65,dp:28,err:8}),
  mb('hs-2b','Akira','Tanaka',4,'2B','L','R',{cL:65,cR:72,pL:28,pR:32,eye:68,ak:70,gap:35,spd:70,stl:58,bnt:62,clt:48},{rng:78,arm:52,acc:72,dp:80,err:14}),
  mb('hs-ss','Manu','Tavares',2,'SS','R','R',{cL:65,cR:68,pL:35,pR:40,eye:60,ak:58,gap:42,spd:78,stl:68,bnt:52,clt:55},{rng:82,arm:72,acc:75,dp:75,err:12}),
  mb('hs-1b','Koa','Nunes',24,'1B','L','L',{cL:52,cR:65,pL:60,pR:68,eye:55,ak:50,gap:62,spd:35,stl:12,bnt:18,clt:52},{rng:55,arm:50,acc:60,dp:55,err:25}),
  mb('hs-rf','Lani','Chang',21,'RF','R','R',{cL:62,cR:65,pL:48,pR:55,eye:55,ak:52,gap:52,spd:65,stl:48,bnt:32,clt:52},{rng:65,arm:70,acc:65,dp:28,err:20}),
  mb('hs-dh','Duke','Makoa',35,'DH','R','R',{cL:52,cR:60,pL:62,pR:70,eye:50,ak:42,gap:65,spd:30,stl:8,bnt:10,clt:60},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('hs-3b','Keoni','Silva',15,'3B','R','R',{cL:58,cR:62,pL:48,pR:55,eye:55,ak:52,gap:52,spd:52,stl:30,bnt:35,clt:52},{rng:68,arm:68,acc:65,dp:55,err:22}),
  mb('hs-lf','Tua','Kahele',22,'LF','L','R',{cL:55,cR:65,pL:42,pR:48,eye:55,ak:52,gap:48,spd:72,stl:60,bnt:38,clt:48},{rng:68,arm:58,acc:62,dp:28,err:22}),
  mb('hs-c','Brock','Ishikawa',12,'C','R','R',{cL:50,cR:58,pL:45,pR:52,eye:52,ak:50,gap:48,spd:30,stl:8,bnt:22,clt:55},{rng:68,arm:72,acc:68,dp:45,err:20}),
  mb('hs-bn1','Nalu','Iona',9,'CF','L','R',{cL:50,cR:58,pL:28,pR:32,eye:52,ak:55,gap:32,spd:82,stl:75,bnt:55,clt:42},{rng:85,arm:58,acc:60,dp:25,err:10}),
  mb('hs-bn2','Kimo','Aoki',6,'2B','L','R',{cL:55,cR:60,pL:22,pR:25,eye:60,ak:62,gap:28,spd:65,stl:52,bnt:60,clt:42},{rng:72,arm:48,acc:68,dp:75,err:16}),
  mb('hs-bn3','Lei','Kamaka',36,'C','R','R',{cL:42,cR:48,pL:38,pR:42,eye:48,ak:48,gap:38,spd:28,stl:5,bnt:20,clt:52},{rng:62,arm:68,acc:62,dp:40,err:22}),
  mb('hs-bn4','Lono','Hale',38,'1B','L','L',{cL:42,cR:52,pL:52,pR:58,eye:48,ak:42,gap:52,spd:28,stl:3,bnt:12,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('hs-sp1','Cole','Yamaguchi',33,'R','R',{stuff:64,movement:62,control:64,stamina:70,velocity:93,hold_runners:52,groundball_pct:50,repertoire:['fastball','splitter','slider','changeup']},28),
  mp('hs-sp2','Kai','Fukuda',41,'L','L',{stuff:60,movement:62,control:62,stamina:68,velocity:90,hold_runners:58,groundball_pct:56,repertoire:['sinker','changeup','curveball','splitter']},27),
  mp('hs-sp3','Troy','Watanabe',49,'R','R',{stuff:58,movement:60,control:60,stamina:66,velocity:92,hold_runners:50,groundball_pct:50,repertoire:['fastball','slider','changeup']},29),
  mp('hs-sp4','Brent','Ogata',52,'R','R',{stuff:55,movement:58,control:60,stamina:64,velocity:91,hold_runners:48,groundball_pct:52,repertoire:['fastball','cutter','changeup']},26),
  mp('hs-sp5','Shane','Kimura',37,'L','L',{stuff:52,movement:55,control:58,stamina:62,velocity:89,hold_runners:52,groundball_pct:56,repertoire:['sinker','changeup','curveball']},30),
  mp('hs-rp1','Nori','Sato',55,'R','R',{stuff:66,movement:65,control:60,stamina:42,velocity:96,hold_runners:50,groundball_pct:42,repertoire:['fastball','splitter']}),
  mp('hs-rp2','Jin','Hayashi',60,'L','L',{stuff:58,movement:62,control:58,stamina:48,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('hs-rp3','Dane','Lum',45,'R','R',{stuff:68,movement:65,control:52,stamina:30,velocity:98,hold_runners:42,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('hs-rp4','Kele','Oshiro',63,'R','R',{stuff:55,movement:55,control:58,stamina:50,velocity:93,hold_runners:48,groundball_pct:50,repertoire:['fastball','splitter']}),
  mp('hs-rp5','Sam','Miyake',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:89,hold_runners:52,groundball_pct:56,repertoire:['sinker','curveball']}),
  mp('hs-rp6','Tad','Inouye',70,'R','R',{stuff:50,movement:52,control:55,stamina:48,velocity:92,hold_runners:45,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('hs-rp7','Hugh','Kono',73,'R','R',{stuff:48,movement:50,control:58,stamina:50,velocity:90,hold_runners:48,groundball_pct:52,repertoire:['sinker','changeup']}),
];

// 28. Tucson Scorpions — desert power, aggressive swings
const tucsonScorpionsPlayers: Player[] = [
  mb('ts-cf','Bryce','Hadley',8,'CF','R','R',{cL:58,cR:62,pL:48,pR:55,eye:52,ak:48,gap:52,spd:78,stl:65,bnt:35,clt:50},{rng:80,arm:65,acc:65,dp:28,err:16}),
  mb('ts-2b','Felix','Moreno',4,'2B','R','R',{cL:58,cR:65,pL:38,pR:42,eye:55,ak:52,gap:45,spd:62,stl:48,bnt:48,clt:48},{rng:70,arm:52,acc:68,dp:72,err:20}),
  mb('ts-ss','Rio','Castillo',2,'SS','R','R',{cL:60,cR:65,pL:45,pR:52,eye:52,ak:48,gap:50,spd:70,stl:58,bnt:40,clt:52},{rng:75,arm:70,acc:68,dp:68,err:18}),
  mb('ts-1b','Knox','Draper',25,'1B','R','R',{cL:52,cR:58,pL:78,pR:85,eye:48,ak:38,gap:80,spd:25,stl:3,bnt:5,clt:68},{rng:48,arm:48,acc:55,dp:50,err:32}),
  mb('ts-rf','Blaze','Harmon',33,'RF','R','R',{cL:55,cR:62,pL:72,pR:78,eye:48,ak:40,gap:75,spd:48,stl:18,bnt:12,clt:65},{rng:55,arm:78,acc:62,dp:28,err:28}),
  mb('ts-dh','Thor','Grimes',40,'DH','R','R',{cL:48,cR:58,pL:80,pR:88,eye:42,ak:32,gap:82,spd:22,stl:2,bnt:5,clt:72},{rng:20,arm:35,acc:35,dp:20,err:78}),
  mb('ts-3b','Mack','Aguilar',15,'3B','R','R',{cL:55,cR:60,pL:68,pR:72,eye:48,ak:42,gap:68,spd:38,stl:15,bnt:20,clt:62},{rng:62,arm:72,acc:62,dp:52,err:26}),
  mb('ts-lf','Dusty','Vega',22,'LF','L','L',{cL:50,cR:60,pL:65,pR:72,eye:48,ak:40,gap:68,spd:52,stl:28,bnt:15,clt:52},{rng:55,arm:55,acc:52,dp:25,err:30}),
  mb('ts-c','Abel','Fuentes',12,'C','R','R',{cL:50,cR:58,pL:52,pR:58,eye:48,ak:45,gap:55,spd:28,stl:5,bnt:18,clt:58},{rng:62,arm:70,acc:65,dp:42,err:25}),
  mb('ts-bn1','Zeb','Norwood',9,'RF','R','R',{cL:45,cR:52,pL:62,pR:68,eye:42,ak:35,gap:62,spd:42,stl:12,bnt:10,clt:52},{rng:52,arm:72,acc:58,dp:25,err:30}),
  mb('ts-bn2','Colt','Rangel',6,'3B','R','R',{cL:48,cR:55,pL:55,pR:62,eye:42,ak:38,gap:58,spd:38,stl:12,bnt:18,clt:50},{rng:58,arm:65,acc:58,dp:50,err:28}),
  mb('ts-bn3','Gino','Rojas',36,'C','R','R',{cL:42,cR:48,pL:48,pR:52,eye:42,ak:40,gap:48,spd:25,stl:3,bnt:15,clt:52},{rng:58,arm:68,acc:58,dp:38,err:28}),
  mb('ts-bn4','Brick','Yates',38,'1B','R','R',{cL:42,cR:48,pL:68,pR:72,eye:38,ak:30,gap:68,spd:22,stl:2,bnt:5,clt:55},{rng:48,arm:42,acc:48,dp:45,err:38}),
  mp('ts-sp1','Stone','Kessler',33,'R','R',{stuff:64,movement:60,control:60,stamina:72,velocity:95,hold_runners:48,groundball_pct:42,repertoire:['fastball','slider','changeup']},28),
  mp('ts-sp2','Clint','Ochoa',41,'R','R',{stuff:60,movement:58,control:58,stamina:68,velocity:94,hold_runners:48,groundball_pct:45,repertoire:['fastball','curveball','changeup']},30),
  mp('ts-sp3','Wyatt','Padilla',49,'L','L',{stuff:56,movement:58,control:56,stamina:66,velocity:91,hold_runners:52,groundball_pct:52,repertoire:['sinker','changeup','curveball']},27),
  mp('ts-sp4','Cade','Vigil',52,'R','R',{stuff:54,movement:55,control:58,stamina:64,velocity:93,hold_runners:45,groundball_pct:45,repertoire:['fastball','slider','changeup']},29),
  mp('ts-sp5','Roy','Herrera',37,'R','R',{stuff:52,movement:52,control:56,stamina:62,velocity:91,hold_runners:48,groundball_pct:48,repertoire:['fastball','cutter','curveball']},31),
  mp('ts-rp1','Viper','Knox',55,'R','R',{stuff:66,movement:62,control:55,stamina:42,velocity:98,hold_runners:45,groundball_pct:35,repertoire:['fastball','slider']}),
  mp('ts-rp2','Cruz','Aranda',60,'L','L',{stuff:56,movement:60,control:55,stamina:48,velocity:91,hold_runners:52,groundball_pct:55,repertoire:['sinker','changeup']}),
  mp('ts-rp3','Rex','Blaylock',45,'R','R',{stuff:68,movement:65,control:50,stamina:30,velocity:100,hold_runners:42,groundball_pct:30,repertoire:['fastball','slider']}),
  mp('ts-rp4','Mike','Rael',63,'R','R',{stuff:54,movement:52,control:58,stamina:50,velocity:94,hold_runners:48,groundball_pct:45,repertoire:['fastball','cutter']}),
  mp('ts-rp5','Tony','Hinojosa',66,'L','L',{stuff:50,movement:55,control:52,stamina:45,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','curveball']}),
  mp('ts-rp6','Manny','Trejo',70,'R','R',{stuff:48,movement:50,control:55,stamina:48,velocity:93,hold_runners:45,groundball_pct:42,repertoire:['fastball','slider']}),
  mp('ts-rp7','Gil','Lucero',73,'R','R',{stuff:46,movement:48,control:56,stamina:50,velocity:91,hold_runners:48,groundball_pct:48,repertoire:['sinker','changeup']}),
];

// 29. San Jose Surf — west coast vibes, lefty-heavy lineup
const sanJoseSurfPlayers: Player[] = [
  mb('sjs-cf','Kai','Nguyen',1,'CF','L','R',{cL:55,cR:66,pL:40,pR:45,eye:60,ak:58,gap:48,spd:80,stl:70,bnt:48,clt:50},{rng:82,arm:62,acc:65,dp:28,err:14}),
  mb('sjs-2b','Mason','Ito',4,'2B','L','R',{cL:60,cR:68,pL:30,pR:35,eye:65,ak:62,gap:38,spd:65,stl:50,bnt:55,clt:48},{rng:72,arm:52,acc:70,dp:75,err:18}),
  mb('sjs-ss','Leo','Sandoval',2,'SS','L','R',{cL:58,cR:65,pL:38,pR:42,eye:60,ak:58,gap:45,spd:72,stl:58,bnt:50,clt:55},{rng:78,arm:68,acc:72,dp:72,err:16}),
  mb('sjs-1b','Reef','O\'Sullivan',24,'1B','L','L',{cL:52,cR:68,pL:68,pR:75,eye:58,ak:50,gap:70,spd:28,stl:5,bnt:10,clt:58},{rng:55,arm:48,acc:58,dp:52,err:28}),
  mb('sjs-rf','Cruz','Guerrero',21,'RF','L','L',{cL:55,cR:65,pL:62,pR:70,eye:55,ak:48,gap:65,spd:52,stl:28,bnt:18,clt:55},{rng:58,arm:68,acc:62,dp:28,err:25}),
  mb('sjs-dh','Bear','Costa',35,'DH','L','R',{cL:50,cR:65,pL:70,pR:78,eye:52,ak:42,gap:72,spd:28,stl:5,bnt:8,clt:62},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('sjs-3b','Pablo','Montero',15,'3B','L','R',{cL:55,cR:62,pL:58,pR:62,eye:55,ak:50,gap:58,spd:42,stl:18,bnt:28,clt:55},{rng:65,arm:68,acc:62,dp:52,err:25}),
  mb('sjs-lf','Troy','Reeves',22,'LF','L','R',{cL:52,cR:65,pL:55,pR:62,eye:55,ak:50,gap:58,spd:62,stl:45,bnt:25,clt:50},{rng:62,arm:55,acc:58,dp:28,err:26}),
  mb('sjs-c','Derek','Fong',12,'C','R','R',{cL:52,cR:58,pL:48,pR:55,eye:55,ak:52,gap:52,spd:30,stl:8,bnt:20,clt:58},{rng:68,arm:72,acc:68,dp:45,err:20}),
  mb('sjs-bn1','Koa','Vu',9,'CF','L','R',{cL:48,cR:58,pL:32,pR:38,eye:52,ak:52,gap:38,spd:75,stl:65,bnt:48,clt:42},{rng:78,arm:58,acc:60,dp:25,err:16}),
  mb('sjs-bn2','Ellis','Park',6,'2B','L','R',{cL:52,cR:58,pL:25,pR:28,eye:58,ak:58,gap:30,spd:60,stl:45,bnt:55,clt:42},{rng:70,arm:48,acc:65,dp:72,err:18}),
  mb('sjs-bn3','Ren','Hashimoto',36,'C','R','R',{cL:42,cR:50,pL:42,pR:48,eye:48,ak:48,gap:42,spd:28,stl:5,bnt:18,clt:52},{rng:62,arm:68,acc:62,dp:40,err:25}),
  mb('sjs-bn4','Milo','Walsh',38,'1B','L','L',{cL:45,cR:55,pL:58,pR:62,eye:50,ak:42,gap:55,spd:28,stl:3,bnt:8,clt:48},{rng:50,arm:45,acc:52,dp:48,err:30}),
  mp('sjs-sp1','Braden','Lowe',33,'L','L',{stuff:66,movement:64,control:66,stamina:72,velocity:92,hold_runners:58,groundball_pct:54,repertoire:['fastball','curveball','changeup','cutter']},28),
  mp('sjs-sp2','Hiro','Tanaka',41,'R','R',{stuff:62,movement:64,control:64,stamina:70,velocity:91,hold_runners:52,groundball_pct:52,repertoire:['fastball','splitter','slider','changeup']},29),
  mp('sjs-sp3','Finn','Callahan',49,'L','L',{stuff:60,movement:60,control:62,stamina:68,velocity:90,hold_runners:55,groundball_pct:56,repertoire:['sinker','changeup','curveball']},27),
  mp('sjs-sp4','Zach','Chen',52,'R','R',{stuff:56,movement:58,control:60,stamina:66,velocity:91,hold_runners:48,groundball_pct:50,repertoire:['fastball','slider','changeup']},30),
  mp('sjs-sp5','Evan','Matsuda',37,'L','L',{stuff:54,movement:56,control:60,stamina:64,velocity:89,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup','curveball']},26),
  mp('sjs-rp1','Jet','Okada',55,'R','R',{stuff:66,movement:62,control:58,stamina:42,velocity:96,hold_runners:48,groundball_pct:40,repertoire:['fastball','splitter']}),
  mp('sjs-rp2','Kai','Higa',60,'L','L',{stuff:58,movement:62,control:58,stamina:48,velocity:90,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup']}),
  mp('sjs-rp3','Tao','Reed',45,'R','R',{stuff:70,movement:65,control:52,stamina:30,velocity:98,hold_runners:42,groundball_pct:32,repertoire:['fastball','slider']}),
  mp('sjs-rp4','Andy','Tran',63,'R','R',{stuff:55,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:50,repertoire:['fastball','cutter','changeup']}),
  mp('sjs-rp5','Gil','Sakamoto',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:89,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('sjs-rp6','Ned','Ueno',70,'R','R',{stuff:50,movement:52,control:55,stamina:48,velocity:92,hold_runners:45,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('sjs-rp7','Otto','Kwon',73,'R','R',{stuff:48,movement:50,control:58,stamina:50,velocity:90,hold_runners:48,groundball_pct:52,repertoire:['sinker','changeup']}),
];

// 30. Boise Stampede — tough, gritty, small-ball with good defense
const boiseStampedePlayers: Player[] = [
  mb('bs-cf','Cody','Steele',8,'CF','R','R',{cL:62,cR:65,pL:35,pR:40,eye:60,ak:58,gap:42,spd:80,stl:70,bnt:55,clt:52},{rng:85,arm:65,acc:68,dp:28,err:12}),
  mb('bs-2b','Finn','Doyle',4,'2B','L','R',{cL:65,cR:70,pL:25,pR:28,eye:68,ak:68,gap:32,spd:62,stl:48,bnt:62,clt:50},{rng:78,arm:52,acc:75,dp:80,err:14}),
  mb('bs-ss','Tate','Rutledge',2,'SS','R','R',{cL:62,cR:65,pL:35,pR:40,eye:60,ak:58,gap:42,spd:72,stl:60,bnt:52,clt:55},{rng:82,arm:72,acc:78,dp:75,err:12}),
  mb('bs-1b','Boone','Caldwell',24,'1B','L','L',{cL:52,cR:62,pL:60,pR:68,eye:58,ak:50,gap:62,spd:30,stl:8,bnt:15,clt:55},{rng:58,arm:50,acc:62,dp:55,err:24}),
  mb('bs-rf','Brock','Henning',21,'RF','R','R',{cL:55,cR:60,pL:52,pR:58,eye:55,ak:50,gap:55,spd:55,stl:30,bnt:22,clt:55},{rng:65,arm:75,acc:68,dp:30,err:20}),
  mb('bs-dh','Ridge','Barlow',35,'DH','R','R',{cL:50,cR:58,pL:60,pR:68,eye:52,ak:45,gap:62,spd:28,stl:5,bnt:8,clt:58},{rng:20,arm:38,acc:38,dp:20,err:72}),
  mb('bs-3b','Shane','Colter',15,'3B','R','R',{cL:58,cR:62,pL:50,pR:55,eye:58,ak:55,gap:52,spd:45,stl:20,bnt:35,clt:58},{rng:72,arm:72,acc:70,dp:60,err:18}),
  mb('bs-lf','Dale','Shepherd',17,'LF','L','R',{cL:52,cR:62,pL:48,pR:55,eye:55,ak:52,gap:52,spd:62,stl:45,bnt:32,clt:48},{rng:65,arm:58,acc:62,dp:28,err:22}),
  mb('bs-c','Nash','Winters',12,'C','R','R',{cL:55,cR:60,pL:42,pR:48,eye:58,ak:55,gap:45,spd:28,stl:5,bnt:22,clt:62},{rng:72,arm:78,acc:75,dp:50,err:15}),
  mb('bs-bn1','Grit','Flynn',9,'CF','R','R',{cL:48,cR:55,pL:28,pR:32,eye:52,ak:55,gap:32,spd:75,stl:65,bnt:52,clt:42},{rng:80,arm:60,acc:62,dp:25,err:14}),
  mb('bs-bn2','Jed','Pratt',6,'SS','R','R',{cL:52,cR:58,pL:28,pR:32,eye:55,ak:55,gap:32,spd:68,stl:55,bnt:55,clt:45},{rng:78,arm:65,acc:70,dp:72,err:15}),
  mb('bs-bn3','Chet','Loomis',36,'C','R','R',{cL:42,cR:50,pL:38,pR:42,eye:52,ak:52,gap:38,spd:28,stl:5,bnt:20,clt:55},{rng:68,arm:72,acc:68,dp:45,err:18}),
  mb('bs-bn4','Troy','Bader',38,'1B','L','L',{cL:45,cR:52,pL:52,pR:58,eye:50,ak:45,gap:52,spd:28,stl:3,bnt:12,clt:48},{rng:52,arm:48,acc:55,dp:52,err:28}),
  mp('bs-sp1','Grant','Everett',33,'R','R',{stuff:66,movement:66,control:68,stamina:74,velocity:93,hold_runners:55,groundball_pct:55,repertoire:['sinker','slider','changeup','curveball']},28),
  mp('bs-sp2','Wyatt','Clifford',41,'L','L',{stuff:62,movement:64,control:66,stamina:70,velocity:91,hold_runners:58,groundball_pct:58,repertoire:['sinker','curveball','changeup']},30),
  mp('bs-sp3','Hank','Dillard',49,'R','R',{stuff:58,movement:62,control:62,stamina:68,velocity:92,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']},27),
  mp('bs-sp4','Clay','Metcalf',52,'R','R',{stuff:56,movement:58,control:62,stamina:66,velocity:90,hold_runners:52,groundball_pct:55,repertoire:['sinker','slider','changeup']},29),
  mp('bs-sp5','Lee','Osgood',37,'L','L',{stuff:54,movement:56,control:62,stamina:64,velocity:89,hold_runners:55,groundball_pct:58,repertoire:['sinker','changeup','curveball']},31),
  mp('bs-rp1','Buck','Shelton',55,'R','R',{stuff:66,movement:65,control:62,stamina:44,velocity:96,hold_runners:52,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('bs-rp2','Wade','Breck',60,'L','L',{stuff:60,movement:62,control:60,stamina:48,velocity:90,hold_runners:55,groundball_pct:60,repertoire:['sinker','changeup','curveball']}),
  mp('bs-rp3','Slade','Drummond',45,'R','R',{stuff:70,movement:68,control:56,stamina:32,velocity:98,hold_runners:45,groundball_pct:38,repertoire:['fastball','slider']}),
  mp('bs-rp4','Colt','Biggs',63,'R','R',{stuff:56,movement:55,control:60,stamina:50,velocity:93,hold_runners:50,groundball_pct:52,repertoire:['fastball','cutter','changeup']}),
  mp('bs-rp5','Ned','Vail',66,'L','L',{stuff:52,movement:58,control:55,stamina:45,velocity:89,hold_runners:52,groundball_pct:58,repertoire:['sinker','curveball']}),
  mp('bs-rp6','Gus','Tuttle',70,'R','R',{stuff:50,movement:52,control:58,stamina:48,velocity:92,hold_runners:48,groundball_pct:48,repertoire:['fastball','slider']}),
  mp('bs-rp7','Roy','Beal',73,'R','R',{stuff:48,movement:50,control:60,stamina:50,velocity:90,hold_runners:50,groundball_pct:55,repertoire:['sinker','changeup','cutter']}),
];

// ═══════════════════════════════════════════════════════════
// BUILD ALL 30 TEAMS
// ═══════════════════════════════════════════════════════════

const THUNDERHAWKS = makeTeam('thunderhawks', 'Thunderhawks', 'THK', 'Austin', '#1a3a5c', '#d4a843', thunderhawksPlayers);
const IRONCLADS = makeTeam('ironclads', 'Ironclads', 'ICL', 'Pittsburgh', '#2d2d2d', '#c44d4d', ironcladsPlayers);
const KNIGHTS = makeTeam('knights', 'Knights', 'CLT', 'Charlotte', '#1c2951', '#c0c0c0', charlotteKnightsPlayers);
const TIDES = makeTeam('tides', 'Tides', 'NFK', 'Norfolk', '#004c6d', '#5eb3d4', norfolkTidesPlayers);
const COLONIALS = makeTeam('colonials', 'Colonials', 'HFD', 'Hartford', '#3b1f2b', '#c9a96e', hartfordColonialsPlayers);

const SOUNDS = makeTeam('sounds', 'Sounds', 'NSH', 'Nashville', '#b8860b', '#1a1a2e', nashvilleSoundsPlayers);
const RAILMEN = makeTeam('railmen', 'Railmen', 'IND', 'Indianapolis', '#003b5c', '#e87722', indianapolisRailmenPlayers);
const RIVERMEN = makeTeam('rivermen', 'Rivermen', 'MEM', 'Memphis', '#00274c', '#0077c8', memphisRivermenPlayers);
const SLUGGERS = makeTeam('sluggers', 'Sluggers', 'LOU', 'Louisville', '#c41e3a', '#27251f', louisvilleSluggerPlayers);
const PIONEERS = makeTeam('pioneers', 'Pioneers', 'OMA', 'Omaha', '#006847', '#f4c430', omahaPioneersPlayers);

const TIMBER_WOLVES = makeTeam('timber-wolves', 'Timber Wolves', 'POR', 'Portland', '#1b4332', '#adb5bd', portlandTimberWolvesPlayers);
const ACES = makeTeam('aces', 'Aces', 'LVA', 'Las Vegas', '#b8860b', '#1a1a1a', lasVegasAcesPlayers);
const RAPTORS = makeTeam('raptors', 'Raptors', 'SLC', 'Salt Lake', '#5c0923', '#ffa500', saltLakeRaptorsPlayers);
const GOLD_RUSH = makeTeam('gold-rush', 'Gold Rush', 'SAC', 'Sacramento', '#c9a227', '#2d2d2d', sacramentoGoldRushPlayers);
const SIDEWINDERS = makeTeam('sidewinders', 'Sidewinders', 'ABQ', 'Albuquerque', '#d45500', '#3d0c02', albuquerqueSidewindersPlayers);

const SANDGNATS = makeTeam('sandgnats', 'Sandgnats', 'SAV', 'Savannah', '#556b2f', '#e8d5b7', savannahSandgnatsPlayers);
const REBELS = makeTeam('rebels', 'Rebels', 'RIC', 'Richmond', '#862633', '#c0c0c0', richmondRebelsPlayers);
const VOYAGEURS = makeTeam('voyageurs', 'Voyageurs', 'MTL', 'Montreal', '#003da5', '#ef3340', montrealVoyageursPlayers);
const MARLINS = makeTeam('marlins', 'Marlins', 'JAX', 'Jacksonville', '#00a8e1', '#003b5c', jacksonvilleMarlinsPlayers);
const OAKS = makeTeam('oaks', 'Oaks', 'RAL', 'Raleigh', '#2d5a27', '#8b6914', raleighOaksPlayers);

const MISSIONS = makeTeam('missions', 'Missions', 'SAT', 'San Antonio', '#8b4513', '#deb887', sanAntonioMissionsPlayers);
const CRAWDADS = makeTeam('crawdads', 'Crawdads', 'NOL', 'New Orleans', '#7b2d8b', '#ffd700', newOrleansCrawdadsPlayers);
const WRANGLERS = makeTeam('wranglers', 'Wranglers', 'OKC', 'Oklahoma City', '#b22222', '#f5deb3', okcWranglersPlayers);
const BARONS = makeTeam('barons', 'Barons', 'BHM', 'Birmingham', '#1c1c1c', '#cf9f29', birminghamBaronsPlayers);
const DRILLERS = makeTeam('drillers', 'Drillers', 'TUL', 'Tulsa', '#004687', '#e04403', tulsaDrillersPlayers);

const PEAKS = makeTeam('peaks', 'Peaks', 'VAN', 'Vancouver', '#1b365d', '#68c3d4', vancouverPeaksPlayers);
const SHARKS = makeTeam('sharks', 'Sharks', 'HNL', 'Honolulu', '#0077be', '#f5f5dc', honoluluSharksPlayers);
const SCORPIONS = makeTeam('scorpions', 'Scorpions', 'TUC', 'Tucson', '#cc5500', '#1a1a1a', tucsonScorpionsPlayers);
const SURF = makeTeam('surf', 'Surf', 'SJC', 'San Jose', '#00a693', '#f0e68c', sanJoseSurfPlayers);
const STAMPEDE = makeTeam('stampede', 'Stampede', 'BOI', 'Boise', '#4a2c2a', '#d2b48c', boiseStampedePlayers);

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

export const TEAMS: Team[] = [
  // AL East
  THUNDERHAWKS, IRONCLADS, KNIGHTS, TIDES, COLONIALS,
  // AL Central
  SOUNDS, RAILMEN, RIVERMEN, SLUGGERS, PIONEERS,
  // AL West
  TIMBER_WOLVES, ACES, RAPTORS, GOLD_RUSH, SIDEWINDERS,
  // NL East
  SANDGNATS, REBELS, VOYAGEURS, MARLINS, OAKS,
  // NL Central
  MISSIONS, CRAWDADS, WRANGLERS, BARONS, DRILLERS,
  // NL West
  PEAKS, SHARKS, SCORPIONS, SURF, STAMPEDE,
];

export function getTeamById(id: string): Team | undefined {
  return TEAMS.find(t => t.id === id);
}

export const LEAGUE_STRUCTURE: Record<string, Record<string, string[]>> = {
  American: {
    East: ['thunderhawks', 'ironclads', 'knights', 'tides', 'colonials'],
    Central: ['sounds', 'railmen', 'rivermen', 'sluggers', 'pioneers'],
    West: ['timber-wolves', 'aces', 'raptors', 'gold-rush', 'sidewinders'],
  },
  National: {
    East: ['sandgnats', 'rebels', 'voyageurs', 'marlins', 'oaks'],
    Central: ['missions', 'crawdads', 'wranglers', 'barons', 'drillers'],
    West: ['peaks', 'sharks', 'scorpions', 'surf', 'stampede'],
  },
};
