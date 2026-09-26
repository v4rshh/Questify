export type WizardMood = 'neutral' | 'thinking' | 'celebrating' | 'puzzled';
export type NodeStatus = 'locked' | 'unlocked' | 'completed';
export type EnemyKind = 'eye' | 'fleshmaw' | 'hornbrute';

<<<<<<< HEAD
export interface Course {
  id: string;
  title: string;
}
export interface Material {
  id: string;
  filename: string;
  status: string;
}
=======
export interface Course { id: string; title: string; }
export interface Material { id: string; filename: string; status: string; }
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f

export interface AdventureRecord {
  question: string;
  answer: string;
  correct_answer: string;
  concept: string;
}

export interface AdventureProgress {
  mistakes: AdventureRecord[];
  correct_answers: AdventureRecord[];
  level_reward_claimed: boolean;
  treasure_claimed: boolean;
}

export interface GameQuestion {
  prompt: string;
  options: string[];
  source: string;
  page: number | null;
  hint?: string;
}

export interface WizardHelp {
  mode: 'hint' | 'concept';
  title: string;
  content: string;
  cost: number;
  remaining_gems: number;
}

export interface Game {
  node_id: string;
  title: string;
  difficulty: string;
  lesson: string;
  solved_count: number;
  total: number;
  points: number;
  completed: boolean;
  question: GameQuestion | null;
  adventure: AdventureProgress;
}

export interface Feedback {
  correct: boolean;
  explanation: string;
  correct_answer: string;
  xp_earned: number;
  total_xp: number;
  game: Game;
}

export interface Level {
  id: string;
  title: string;
  description: string;
  level_index: number;
  world_index: number;
  mastery_score: number;
  is_unlocked: boolean;
}

export interface World {
  title: string;
  generated: boolean;
  nodes: Level[];
  coverage?: {
    text_sections?: number;
    mapped_topics?: number;
    assigned_topics?: number;
    limitations?: string;
    plan?: { title: string; difficulty: number; prerequisites: string[] }[];
  };
}

<<<<<<< HEAD
export interface MapPoint {
  x: number;
  y: number;
}
=======
export interface MapPoint { x: number; y: number; }
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f

export interface MapLevel extends Level, MapPoint {
  displayWorld: number;
  localIndex: number;
  status: NodeStatus;
  enemy?: EnemyKind;
  isFinal: boolean;
  isTreasureGate: boolean;
}

export interface ReviewData {
  title: string;
  correct: AdventureRecord[];
  mistakes: AdventureRecord[];
}
