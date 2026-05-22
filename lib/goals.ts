export interface Goal {
  id: string;
  name: string;
  description: string;
  charityAccount: string;
  targetHbar: number;
}

export const GOALS: Goal[] = [
  {
    id: "shelter",
    name: "Animal Shelter",
    description:
      "Help for homeless animals – food, medical care, shelter maintenance.",
    charityAccount: process.env.CHARITY_SHELTER!,
    targetHbar: 600_000,
  },
  {
    id: "education",
    name: "Education Foundation 2030",
    description:
      "Scholarships and materials for children from low-income families.",
    charityAccount: process.env.CHARITY_EDUCATION!,
    targetHbar: 400_000,
  },
  {
    id: "flood",
    name: "Flood Relief",
    description: "Support for families affected by flooding.",
    charityAccount: process.env.CHARITY_FLOOD!,
    targetHbar: 900_000,
  },
];
