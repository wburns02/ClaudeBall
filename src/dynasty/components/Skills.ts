import type { Component } from '../ecs/types.ts';
import type { BattingRatings, PitchingRatings, FieldingRatings } from '@/engine/types/player.ts';

export interface ToolGrade {
  current: number;   // 20-80
  potential: number;  // 20-80
}

export interface SkillsComponent extends Component {
  type: 'Skills';
  hitL: ToolGrade;
  hitR: ToolGrade;
  powerL: ToolGrade;
  powerR: ToolGrade;
  eye: ToolGrade;
  speed: ToolGrade;
  arm: ToolGrade;
  field: ToolGrade;
  fastball: ToolGrade;
  breaking: ToolGrade;
  changeup: ToolGrade;
  command: ToolGrade;
}

function to2080(val: number): number {
  return Math.round(val * 0.6 + 20);
}

function grade(current100: number, potentialBonus: number, rng: () => number): ToolGrade {
  const current = to2080(current100);
  const potential = Math.min(80, current + Math.round(rng() * potentialBonus));
  return { current, potential };
}

export function skillsFromRatings(
  batting: BattingRatings,
  pitching: PitchingRatings,
  fielding: FieldingRatings[],
  rng: () => number,
): SkillsComponent {
  const primaryFielding = fielding[0];
  const potBonus = 15;

  return {
    type: 'Skills',
    hitL: grade(batting.contact_L, potBonus, rng),
    hitR: grade(batting.contact_R, potBonus, rng),
    powerL: grade(batting.power_L, potBonus, rng),
    powerR: grade(batting.power_R, potBonus, rng),
    eye: grade(batting.eye, potBonus, rng),
    speed: grade(batting.speed, potBonus, rng),
    arm: grade(primaryFielding?.arm_strength ?? 50, potBonus, rng),
    field: grade(primaryFielding?.range ?? 50, potBonus, rng),
    fastball: grade(pitching.stuff, potBonus, rng),
    breaking: grade(pitching.movement, potBonus, rng),
    changeup: grade(Math.round(pitching.stuff * 0.5 + pitching.control * 0.5), potBonus, rng),
    command: grade(pitching.control, potBonus, rng),
  };
}
