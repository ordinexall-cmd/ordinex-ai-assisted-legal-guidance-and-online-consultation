export const SECURITY_QUESTIONS = [
  'What was the name of your first elementary school?',
  'What is the street name where you grew up?',
  'What was the name of your first childhood pet?',
  'What city or municipality were you born in?',
  'What is your mother’s maiden family name?',
  'What was your favorite subject or teacher in school?',
] as const;

export const CUSTOM_SECURITY_QUESTION_VALUE = '__custom__';

export type SecurityQuestion = typeof SECURITY_QUESTIONS[number];
