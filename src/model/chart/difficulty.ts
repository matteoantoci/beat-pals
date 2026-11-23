// The choice of difficulty for one part of a chart. The reader takes each part at the highest difficulty
// present (spec, "The facts file"). Both chart formats use this function for each part.

const DIFFICULTIES = ['Expert', 'Hard', 'Medium', 'Easy'] as const;

/** A difficulty, with the name that the .chart sections use. */
export type Difficulty = (typeof DIFFICULTIES)[number];

/** The notes of a part at the highest difficulty that has notes. Undefined when no difficulty has notes. */
export const highestDifficulty = <Note>(
  notesAt: (difficulty: Difficulty) => readonly Note[]
): readonly Note[] | undefined => DIFFICULTIES.map(notesAt).find((notes) => notes.length > 0);
