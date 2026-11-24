import type { LegalDoc } from "./types";

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms & Conditions",
  intro:
    "These terms explain how XArena works and what we expect from you. Please read them before you create an account, add money or join a tournament. By signing up or using XArena, you agree to them.",
  sections: [
    {
      title: "About XArena",
      paras: [
        "XArena is an online platform where players take part in esports tournaments, compete for prizes and track their results. Each tournament shows its own game, mode, entry fee, prize pool, slots and start time before you join.",
        "XArena is an independent platform. We are not sponsored or endorsed by the publishers of the games played in our tournaments, and game names and logos belong to their respective owners.",
      ],
    },
    {
      title: "Who can use XArena",
      bullets: [
        "You must be 18 years or older and legally able to enter into a contract.",
        "You may have only one account. Creating extra accounts, or using someone else's, is not allowed.",
        "You are responsible for making sure that taking part in tournaments is lawful where you live. If paid contests are not permitted where you live, do not join them.",
      ],
    },
    {
      title: "Your account",
      paras: [
        "Give us accurate details when you sign up and keep them up to date. Keep your password private. Anything done through your account is treated as done by you, so tell us straight away if you think someone else has access.",
        "We may ask you to verify your details, and we may limit or suspend an account while we look into a problem.",
      ],
    },
    {
      title: "Tournaments",
      paras: [
        "Tournaments on XArena are competitions of gaming skill. Each tournament has its own rules, which you must accept before joining. Joining a tournament means you agree to those rules and to these terms.",
      ],
      bullets: [
        "Enter your correct in-game name and Game UID. Wrong details can lead to disqualification.",
        "Room or match details are shared inside the app. Join on time, as late players may miss the match.",
        "The entry fee is taken from your wallet when you join and your slot is reserved.",
        "We may reschedule, change or cancel a tournament if needed. If we cancel one, your entry fee is refunded as explained in our Refund Policy.",
      ],
    },
    {
      title: "Fair play",
      paras: ["We want every tournament to be fair. The following are not allowed:"],
      bullets: [
        "Using hacks, cheats, scripts or any tool or software the tournament rules prohibit.",
        "Teaming up or colluding with opponents, or deliberately losing to help someone else.",
        "Using multiple accounts, impersonating another player, or letting someone else play for you.",
        "Abusing bugs or exploits, or submitting edited or false screenshots or results.",
        "Abusive, hateful or threatening behaviour towards other players or our team.",
      ],
      after: [
        "If we find or reasonably believe that you have broken these rules, we may disqualify you, withhold or reverse prizes won unfairly, suspend or close your account, or take other action that the situation calls for.",
      ],
    },
    {
      title: "Results and prizes",
      paras: [
        "After a match you may be asked to submit your result with a screenshot. Our team checks results before they are final. If you disagree with a result, contact Support promptly with your evidence and we will review it. Our decision after review is final.",
        "Prizes are shown on each tournament page and are credited to your winning balance after the result is verified. If a tournament has a split prize pool, the split shown on the tournament page applies.",
      ],
    },
    {
      title: "Your wallet",
      paras: ["Your XArena wallet keeps three separate balances:"],
      bullets: [
        "Deposit balance: money you have added. You can use it to join tournaments, but it cannot be withdrawn.",
        "Winning balance: prizes you have won. This is the only balance you can withdraw.",
        "Bonus balance: promotional credit. It can be used to join tournaments as per the offer, and it cannot be withdrawn.",
      ],
      after: ["When you join a tournament, the entry fee is taken first from your bonus balance, then your deposit balance, and then your winning balance."],
    },
    {
      title: "Adding money",
      paras: [
        "Money is added by paying through UPI and then submitting the payment details. Our team verifies each payment, and your wallet is credited after it is approved.",
      ],
      bullets: [
        "Pay the exact amount you entered, using the payment details shown in the app.",
        "Submit the correct UTR number and a genuine payment screenshot.",
        "Do not send money to anyone outside this process. XArena will never ask you to pay to a personal account over chat or calls.",
        "Fake, edited or reused payment proof will lead to rejection and may lead to account suspension.",
      ],
    },
    {
      title: "Withdrawals",
      bullets: [
        "You can withdraw only from your winning balance. The minimum withdrawal is ₹100.",
        "Money is sent to the UPI ID you provide. Make sure it is yours and is correct, as we cannot recover money sent to a wrong ID you entered.",
        "Every withdrawal is reviewed by our team. While a request is pending, the amount is held and cannot be used.",
        "If a request is rejected, the amount goes back to your winning balance and you will be told the reason.",
        "We may ask for extra information to verify you before paying out.",
      ],
      after: [
        "Prizes may be subject to tax under Indian law. You are responsible for your own tax obligations, and we may deduct tax at source where the law requires it.",
      ],
    },
    {
      title: "Referrals and offers",
      paras: [
        "You may be able to invite friends with your referral code and earn rewards under the offer shown in the app. Each person may be referred once. Self-referrals, multiple accounts or any attempt to misuse an offer will make the reward void and may lead to account action. We may change or end an offer at any time.",
      ],
    },
    {
      title: "Playing responsibly",
      paras: [
        "Play for fun and only spend what you can comfortably afford. Do not treat tournaments as a way to earn income. If you feel your play is becoming a problem, take a break and contact Support to restrict or close your account.",
      ],
    },
    {
      title: "Suspension and closing your account",
      paras: [
        "We may suspend or close an account if these terms are broken, if we are required to by law, or to protect other players. If an account is closed for cheating or fraud, we may withhold or reverse the winnings and balances connected with it.",
        "You can ask us to close your account at any time. Withdrawable winnings are paid out after the usual review, unless there is an open investigation.",
      ],
    },
    {
      title: "Our content",
      paras: [
        "The XArena name, logo, design and the software behind the platform belong to us. You may not copy, scrape or reuse them without our written permission.",
      ],
    },
    {
      title: "Availability and our responsibility",
      paras: [
        "We work to keep XArena running smoothly, but we cannot promise it will always be available or error-free. We are not responsible for problems outside our control, such as game server issues, your internet connection or your device.",
        "To the extent the law allows, our responsibility to you for any claim connected with a tournament is limited to the entry fee you paid for that tournament, and for any other claim to the balance in your wallet at the time.",
      ],
    },
    {
      title: "Changes to these terms",
      paras: [
        "We may update these terms from time to time. The date at the top shows when they were last changed. If a change is important, we will tell you in the app. Continuing to use XArena after a change means you accept it.",
      ],
    },
    {
      title: "Governing law and contact",
      paras: [
        "These terms are governed by the laws of India. If you have a problem, please contact us first through the Support page so we can try to resolve it. Any dispute that cannot be resolved will be handled by the courts in India that have jurisdiction.",
      ],
    },
  ],
};
