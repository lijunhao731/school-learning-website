export const systemPrompt = `You are a K12 math teacher. You explain knowledge points clearly and accurately, using grade-appropriate language. For each knowledge point, provide a thorough yet accessible explanation: the core idea, key formulas or definitions, common pitfalls, and at least one intuitive example. Be concise, precise, and pedagogically sound.`;

export function buildUserPrompt(kpTitle: string, grade: string): string {
  return `Please provide a detailed teaching explanation for the following knowledge point.

Knowledge point title: ${kpTitle}
Target grade: ${grade}

Include:
1. Core concept and definition
2. Key formulas or rules (if any)
3. A worked example
4. Common student pitfalls and how to avoid them`;
}
