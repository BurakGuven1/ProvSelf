import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import type { ChallengeFrequency, ChallengeStatus } from '@/src/types/database';

export interface ProgressChallengeLike {
  start_date: string;
  end_date: string;
  frequency: ChallengeFrequency;
  required_completions: number;
}

export interface ProgressProofLike {
  proof_date: string;
  is_verified: boolean;
}

export type FinalChallengeStatus = Extract<ChallengeStatus, 'completed_success' | 'completed_fail'>;

function clampDateToRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function getWeekSlotKey(startDate: string, proofDate: string): string {
  const diff = differenceInCalendarDays(parseISO(proofDate), parseISO(startDate));
  const index = Math.max(0, Math.floor(diff / 7));
  return `w${index}`;
}

export function getCompletionSlotKey(
  frequency: ChallengeFrequency,
  startDate: string,
  proofDate: string,
): string {
  if (frequency === 'weekly') {
    return getWeekSlotKey(startDate, proofDate);
  }
  return proofDate;
}

function countVerifiedSlots(
  challenge: Pick<ProgressChallengeLike, 'start_date' | 'end_date' | 'frequency'>,
  proofs: ProgressProofLike[],
  boundaryEnd?: string,
): number {
  const slotKeys = new Set<string>();
  const end = boundaryEnd ?? challenge.end_date;

  proofs.forEach((proof) => {
    if (!proof.is_verified) return;
    if (proof.proof_date > end) return;
    if (!clampDateToRange(proof.proof_date, challenge.start_date, challenge.end_date)) return;

    slotKeys.add(getCompletionSlotKey(challenge.frequency, challenge.start_date, proof.proof_date));
  });

  return slotKeys.size;
}

function getExpectedSlotsUntil(
  challenge: Pick<ProgressChallengeLike, 'start_date' | 'frequency'>,
  pastDueEnd: string,
): number {
  if (pastDueEnd < challenge.start_date) return 0;
  const elapsedDays = differenceInCalendarDays(parseISO(pastDueEnd), parseISO(challenge.start_date)) + 1;
  if (challenge.frequency === 'weekly') {
    return Math.floor((elapsedDays - 1) / 7) + 1;
  }
  return elapsedDays;
}

export function countVerifiedCompletions(
  challenge: Pick<ProgressChallengeLike, 'start_date' | 'end_date' | 'frequency'>,
  proofs: ProgressProofLike[],
): number {
  return countVerifiedSlots(challenge, proofs);
}

export function computeChallengeProgress(
  challenge: ProgressChallengeLike,
  proofs: ProgressProofLike[],
): {
  completedDays: number;
  failedDays: number;
  finalStatus: FinalChallengeStatus | null;
} {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

  const completedDays = countVerifiedSlots(challenge, proofs);
  const pastDueEnd = challenge.end_date < yesterdayStr ? challenge.end_date : yesterdayStr;
  const expectedUntilPastDue = getExpectedSlotsUntil(challenge, pastDueEnd);
  const completedPastDue = countVerifiedSlots(challenge, proofs, pastDueEnd);
  const failedDays = Math.max(0, expectedUntilPastDue - completedPastDue);

  const hasEnded = todayStr > challenge.end_date;
  const missedRequiredDay = challenge.frequency === 'daily' && failedDays > 0;

  let finalStatus: FinalChallengeStatus | null = null;
  if (missedRequiredDay || (hasEnded && completedDays < challenge.required_completions)) {
    finalStatus = 'completed_fail';
  } else if (hasEnded && completedDays >= challenge.required_completions) {
    finalStatus = 'completed_success';
  }

  return {
    completedDays,
    failedDays,
    finalStatus,
  };
}
