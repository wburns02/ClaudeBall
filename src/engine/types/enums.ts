export type Position = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';

export type Hand = 'L' | 'R' | 'S'; // Switch

export type PitchType = 'fastball' | 'sinker' | 'cutter' | 'slider' | 'curveball' | 'changeup' | 'splitter' | 'knuckleball';

export type PitchResult = 'ball' | 'called_strike' | 'swinging_strike' | 'foul' | 'contact';

export type ContactType = 'ground_ball' | 'line_drive' | 'fly_ball' | 'popup';

export type HitResult = 'single' | 'double' | 'triple' | 'home_run';

export type OutType = 'strikeout_swinging' | 'strikeout_looking' | 'groundout' | 'flyout' | 'lineout' | 'popout' | 'double_play' | 'triple_play' | 'fielders_choice' | 'sacrifice_fly' | 'sacrifice_bunt';

export type PlayResult = 'hit' | 'out' | 'walk' | 'hit_by_pitch' | 'error' | 'strikeout';

export type Base = 1 | 2 | 3;

export type HalfInning = 'top' | 'bottom';

export type GamePhase = 'pregame' | 'in_progress' | 'final';
