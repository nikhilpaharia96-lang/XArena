import type { LegalDoc } from "./types";

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  intro:
    "This policy explains what personal information XArena collects, why we collect it, who can see it and what choices you have. We keep it to what we need to run tournaments and your wallet.",
  sections: [
    {
      title: "Information you give us",
      bullets: [
        "Account details: your email address, phone number, username and display name, and a password (we store it only in a scrambled, one-way form, never as plain text).",
        "Referral or signup code, if you enter one.",
        "Tournament details: your in-game name and Game UID when you join, and result screenshots you submit.",
        "Payment details: the UTR number and screenshot you submit when adding money, and the UPI ID you enter to withdraw winnings.",
        "Messages you send to Support.",
      ],
    },
    {
      title: "Information we collect automatically",
      bullets: [
        "Login and session information, including your IP address and when you last logged in.",
        "Your activity on XArena: tournaments joined, results, wallet transactions, notifications and stats.",
        "A push notification token, if you allow notifications on your device.",
      ],
    },
    {
      title: "How we use your information",
      bullets: [
        "To create and run your account, tournaments and wallet.",
        "To verify deposits and process withdrawals.",
        "To keep the platform fair: spotting cheating, fraud, multiple accounts and misuse of offers.",
        "To send you notifications about tournaments, results and your wallet.",
        "To answer your Support requests.",
        "To meet legal, tax and accounting obligations.",
        "To fix problems and improve XArena.",
      ],
    },
    {
      title: "Who can see your information",
      paras: ["We do not sell your personal information."],
      bullets: [
        "Other players can see your username or display name, avatar, in-game name and stats where they appear in tournaments and on leaderboards. Your email, phone number, UPI ID and wallet details are not shown to other players.",
        "Our authorised team can access your information when needed to run the platform, check payments and help you. Actions our admins take are recorded.",
        "Service providers that help us host and operate XArena may handle data on our behalf, only to provide that service.",
        "We may share information with authorities or other parties when the law requires it, or to protect the safety and rights of players and XArena.",
      ],
    },
    {
      title: "How we protect it",
      paras: [
        "Passwords are stored using one-way hashing. Access to personal information is limited to authorised staff, and administrator actions are logged. No online system is completely secure, so please use a strong, unique password and never share it or any one-time codes with anyone.",
      ],
    },
    {
      title: "How long we keep it",
      paras: [
        "We keep your information while your account is active and for as long as we need it for the purposes above. After you close your account, we may keep certain records, such as payment and transaction history, for as long as the law requires or as needed to handle disputes, fraud and tax matters.",
      ],
    },
    {
      title: "Your choices and rights",
      paras: [
        "You can ask us to show you the information we hold about you, correct it, or delete your account and data. Some records may have to be kept for legal reasons, and we will tell you if that applies. You can also turn off notifications in your device settings.",
        "To make a request, raise a ticket on the Support page from your account. We may ask you to confirm your identity first.",
      ],
    },
    {
      title: "Cookies and similar storage",
      paras: [
        "We use secure cookies to keep you logged in, and your browser's local storage to remember choices such as light or dark mode. At the time of writing, XArena does not use advertising cookies or third-party analytics trackers.",
      ],
    },
    {
      title: "Age limit",
      paras: ["XArena is for people aged 18 and over. If we learn that an account belongs to someone under 18, we may close it."],
    },
    {
      title: "Changes to this policy",
      paras: ["We may update this policy from time to time. The date at the top shows the latest version, and we will tell you in the app about important changes."],
    },
    {
      title: "Contact us",
      paras: ["For any privacy question, complaint or request, please contact us through the Support page and mark it as a privacy request."],
    },
  ],
};
