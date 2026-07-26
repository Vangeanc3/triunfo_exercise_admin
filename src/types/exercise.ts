export type ExerciseLevel = 'beginner' | 'intermediate' | 'advanced' | string;

export type ExerciseVariation = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
  equipment: string[];
  tips: string[];
  attributes?: Record<string, unknown>;
};

export type ExerciseDefinition = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  region: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment?: string[];
  level: ExerciseLevel;
  mechanic: string;
  tips?: string[];
  commonMistakes: string[];
  stimulus: string;
  exerciseType: string;
  variations?: ExerciseVariation[];
};

export type ExerciseDocument = {
  id: string;
  name: string;
  imageUrl: string;
  regions?: Array<{ id: string; name: string }>;
  exercises: ExerciseDefinition[];
};

export type ExerciseDocumentOption = {
  id: string;
  label: string;
  category: string;
  imageUrl?: string;
};
