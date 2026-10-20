export type Localized = { ru: string; kk: string };

export interface QuizQuestion {
  id: string;
  topic: Localized;
  situation: Localized;
  options: Localized[];
  correct: number;
  explanation: Localized;
}

export interface OfficialResource {
  id: string;
  name: Localized;
  url: string;
  domain: string;
  purpose: Localized;
  when: Localized;
}
