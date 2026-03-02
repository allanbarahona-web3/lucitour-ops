import {
  ContractStatus,
  DocsStatus,
  ItineraryStatus,
  PassportStatus,
  type TripMember,
} from "../types/ops";

const getMemberCompletionRatio = (member: TripMember) => {
  let completed = 0;

  if (member.contractStatus === ContractStatus.SENT) {
    completed += 1;
  }

  if (member.docsStatus === DocsStatus.UPLOADED) {
    completed += 1;
  }

  if (member.passportStatus === PassportStatus.ENTERED) {
    completed += 1;
  }

  if (
    member.itineraryStatus === ItineraryStatus.READY ||
    member.itineraryStatus === ItineraryStatus.NOT_APPLICABLE
  ) {
    completed += 1;
  }

  return completed / 4;
};

export const getTripMetrics = (members: TripMember[]) => {
  const passengerCount = members.length;

  if (passengerCount === 0) {
    return { passengerCount, completionPercent: 0 };
  }

  const totalRatio = members.reduce(
    (accumulator, member) => accumulator + getMemberCompletionRatio(member),
    0,
  );

  const completionPercent = Math.round((totalRatio / passengerCount) * 100);

  return { passengerCount, completionPercent };
};

export const getTripCapacityMetrics = (members: TripMember[], maxSeats: number) => {
  const usedSeats = members.reduce((sum, member) => sum + (member.seats || 0), 0);
  const safeMax = Math.max(0, maxSeats);
  const remainingSeats = Math.max(0, safeMax - usedSeats);
  const percent = safeMax > 0 ? Math.min(100, Math.round((usedSeats / safeMax) * 100)) : 0;
  const isClosed = safeMax > 0 && remainingSeats === 0;

  return { usedSeats, remainingSeats, percent, isClosed };
};
