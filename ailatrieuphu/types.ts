
export interface Question {
  question: string;
  options: string[];
  correctAnswerIndex: number;
}

export enum AppState {
  CREATOR,
  REVIEW,
  PLAYER_SELECTION,
  LOADING_QUESTIONS,
  GAME_START,
  PLAYING,
  ANSWER_SELECTED,
  GAME_OVER,
}

export interface LifelineState {
  fiftyFifty: boolean;
  phoneAFriend: boolean;
  askTheAudience: boolean;
}

export type Difficulty = 'Dễ' | 'Vừa' | 'Khó';

export interface GameConfig {
  topic: string;
  questionCount: number;
  timerDuration: number;
  difficulty: Difficulty;
  audio: {
    correct: File | null;
    incorrect: File | null;
    background: File | null;
  };
}