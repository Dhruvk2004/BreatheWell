/**
 * The person tokens in plan text (spec 7.1): `{m1}` for an adult member, `{d1}` for a dependent.
 * One definition for the validator, the stored-words renderer and the prompt rules.
 */
export const PLAN_TOKEN = /\{([md]\d+)\}/gu;

/** True for a dependent's token (`d1`): their text must also pass the kid-card checks. */
export const isDependentToken = (token: string): boolean => token.startsWith("d");
