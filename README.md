# BreatheWell

**Know when your family can breathe easy.** BreatheWell is a family air coach for winter smog in Indian cities. It reads the air where you live, hour by hour, and tells each person, in English or Hindi, whether to go out today, the best time to go, and one simple change that helps them and the air.

**Live app:** [breathe-well-theta.vercel.app](https://breathe-well-theta.vercel.app/) · Try **Air now** and the **demo family** with no sign-in.

<!-- Screenshots: Air now · Today · kid card · Breezy -->

## Features

- **Air now** for any Indian city: today's air on India's CPCB scale, the next 24 hours, a 5-day outlook, home tips and one low-smoke swap.
- **A plan for every family member**: Go, Go with care or Avoid, the best time to step out, and why it matters, in words a grandparent or a child understands.
- **Family accounts**: adults join with a code or QR. Children are added by a parent and get a simple kid card to show or share on WhatsApp.
- **Breezy**, an air assistant that answers questions and adds reminders to a family member's checklist.
- **A community message** for your housing society or school group, in English and Hindi, ready to share.
- **Built for everyone**: English and Hindi, large text, phone-first screens, and a saved plan when you're offline.

## How it works

Tested rules decide every verdict, time and number. Google Gemini only puts them into friendly words, and its text is checked before it is shown. Names and health details are never sent to the AI.

## Built with

Next.js, React, TypeScript and Tailwind · Firebase Auth and Firestore · Google Gemini · Open-Meteo air data · Vitest, Playwright and axe. Hosted for free on Vercel and Firebase.

## Run it locally

Needs Node 22 or later. With no settings, the public pages and the demo work out of the box.

```bash
npm ci
npm run dev
```

To use sign-in and Gemini, copy `.env.example` to `.env.local` and fill it in (a free Firebase project and a free Gemini key from Google AI Studio). Tests: `npm run check` and `npm run test:e2e`.

## More

- [Notes for judges](docs/judges.md): the challenge brief mapped to features and code, the architecture and security notes.
- Questions or data requests: open an issue in this repository. You can also delete your own data any time from Profile → Delete my account.

## Licence

MIT
