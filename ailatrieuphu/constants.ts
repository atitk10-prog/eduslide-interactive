import { Difficulty } from "./types";

export const DEFAULT_GAME_CONFIG = {
  topic: '',
  questionCount: 15,
  timerDuration: 30,
  difficulty: 'Vừa' as Difficulty,
};

export const MIN_QUESTIONS = 15;
export const MAX_QUESTIONS = 25;