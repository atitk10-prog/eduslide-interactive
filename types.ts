
export enum QuestionType {
  MULTIPLE_CHOICE = 'MCQ',
  MULTI_SELECT = 'MS',
  TRUE_FALSE = 'TF',
  TRUE_FALSE_4 = 'TF4',
  SHORT_ANSWER = 'SA'
}

export interface Question {
  id: string;
  slideIndex: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: any;
  duration: number; // Thời gian trả lời tính bằng giây
}

export interface Slide {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  pdfSource?: string;
  pdfPage?: number;
  questions: Question[];
}

export interface Session {
  id: string;
  roomCode: string;
  title: string;
  currentSlideIndex: number;
  isActive: boolean;
  slides: Slide[];
  responses: AnswerResponse[];
  activeQuestionId: string | null;
  teacherName?: string;
  storageSize?: number; // bytes
  scoreMode?: 'CUMULATIVE' | 'SINGLE';
  createdAt?: string;   // ISO date string
}

export interface AnswerResponse {
  sessionId: string;
  studentName: string;
  studentClass?: string;
  questionId: string;
  answer: any;
  timestamp: number;
}

export interface User {
  id: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  name: string;
}
