import type { LegalDoc } from "./types";

export const REFUND: LegalDoc = {
  slug: "refund",
  title: "Refund Policy",
  intro:
    "This policy explains when you get your money back on XArena: tournament entry fees, payments you have made, and withdrawal requests. Refunds go to your XArena wallet.",
  sections: [
    {
      title: "Tournament entry fees",
      paras: [
        "When you join a tournament, your entry fee reserves a slot for you, so entry fees are not refundable once you have joined, except in the cases below.",
      ],
    },
    {
      title: "When you get a refund",
      bullets: [
        "We cancel the tournament. Every player's entry fee is refunded in full, automatically, and you will get a notification.",
        "Our team removes your registration and chooses to refund it, for example because of a mistake on our side.",
        "You were charged twice or charged the wrong amount for the same tournament. Contact Support and we will check and correct it.",
      ],
      after: ["Refunds are credited to your wallet balance so you can use the money in another tournament."],
    },
    {
      title: "When a refund is not given",
      bullets: [
        "You miss the match, join late, or leave during the match.",
        "You are disqualified or removed for breaking the fair play rules.",
        "You entered a wrong in-game name or Game UID.",
        "The problem was caused by your device, your internet connection or the game's own servers.",
        "A tournament is rescheduled and you can no longer play. The tournament still goes ahead.",
      ],
    },
    {
      title: "Money you add to your wallet",
      paras: [
        "Money you add is credited after our team verifies your payment. Money in your deposit balance is for playing on XArena and cannot be withdrawn to your bank account.",
        "If you paid but your wallet was not credited, or your deposit request was rejected, contact Support with your UTR number and payment screenshot. We will review each case. If we confirm that we received a payment that cannot be credited, we will tell you how we will resolve it.",
        "If you paid by mistake or paid twice, tell us as soon as you can, with proof of payment.",
      ],
    },
    {
      title: "Withdrawals",
      paras: [
        "Withdrawals are paid only from your winning balance. If a withdrawal request is rejected, the full amount goes back to your winning balance and you will see the reason. If you entered a wrong UPI ID and the payment has already been sent, we may not be able to recover it.",
      ],
    },
    {
      title: "Bonus and promotional credit",
      paras: ["Bonus credit and promotional rewards have no cash value. They cannot be refunded or withdrawn."],
    },
    {
      title: "How to ask for a refund",
      paras: ["Raise a ticket on the Support page and include the details below, so we can look into it quickly:"],
      bullets: [
        "Your username and the registered phone number or email.",
        "The tournament name and date, if it is about a tournament.",
        "The UTR number and a screenshot, if it is about a payment.",
        "A short description of what went wrong.",
      ],
      after: ["Our team reviews each request and replies with the outcome and the reason. Our decision after review is final."],
    },
  ],
};
