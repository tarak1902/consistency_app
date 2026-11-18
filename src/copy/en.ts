/**
 * Every user-facing string. Direct, calm, adult. No guilt; state facts.
 * Add hi.ts / te.ts with the same shape later.
 */
import { APP_NAME } from '@/lib/config';
import { DOT, EN_DASH, MINUS, UP, DOWN } from '@/lib/format';

export const en = {
  appName: APP_NAME,
  tagline: 'Measure consistency, not motivation.',

  common: {
    continue: 'Continue',
    back: 'Back',
    done: 'Done',
    cancel: 'Cancel',
    retry: 'Try again',
    close: 'Close',
    skip: 'Skip',
    save: 'Save',
    next: 'Next',
    loading: 'Loading',
    days: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    works: (n: number) => `${n} ${n === 1 ? 'work' : 'works'}`,
  },

  offline: "You're offline. Check-ins need a connection because time is verified by the server.",

  onboarding: {
    s1Title: 'Small daily gains compound.',
    s1Body: (up: string, down: string) =>
      `1% better every day for 90 days ends at ${up}. 1% worse ends at ${down}.`,
    s1Better: '1% better',
    s1Worse: '1% worse',
    s2Title: 'Same work. Every day.',
    s2Body:
      'You choose your works once. They stay locked for 30 to 90 days. Consistency means not changing the plan to fit the mood.',
    s3Title: 'Two scores. One truth.',
    s3Body:
      'Each work has its own score. Your day score only rises when you do all of it. Three of four done still counts as a down day.',
    s3Legend: 'Three works up, one down. The day score goes down.',
    cta: 'Get started',
  },

  auth: {
    apple: 'Continue with Apple',
    google: 'Continue with Google',
    email: 'Continue with email',
    smallPrint: 'By continuing you agree to the',
    terms: 'Terms',
    and: 'and',
    privacy: 'Privacy Policy',
    emailTitle: 'Your email',
    emailBody: "We'll send a 6-digit code. No password needed.",
    emailPlaceholder: 'you@example.com',
    emailInvalid: 'Enter a valid email address.',
    sendCode: 'Send code',
    codeTitle: 'Enter the code',
    codeBody: (email: string) => `We sent a 6-digit code to ${email}.`,
    codeWrong: "That code didn't work. Check it and try again.",
    codeExpired: 'That code has expired. Send a new one.',
    resendIn: (s: number) => `Resend code in ${s}s`,
    resend: 'Resend code',
    resent: 'A new code is on its way.',
    changeEmail: 'Use a different email',
    googleFailed: "Google sign-in didn't complete. Try again.",
    appleFailed: "Apple sign-in didn't complete. Try again.",
    notConfigured: 'This sign-in method is not configured yet.',
    sendFailed: "We couldn't send the email. Try again in a minute.",
  },

  wizard: {
    stepOf: (i: number, n: number) => `Step ${i} of ${n}`,
    worksTitle: 'Your works',
    worksBody: 'The things you will do every day. Be specific. Vague works are easy to fake.',
    workTitlePlaceholder: (i: number) => `Work ${i}, e.g. Quant`,
    workCriteriaPlaceholder: 'What counts as done? (optional)',
    addWork: 'Add a work',
    maxWorks: 'Eight works is the limit.',
    removeWork: (title: string) => `Remove ${title || 'this work'}`,
    moveUp: 'Move up',
    moveDown: 'Move down',
    dragHint: 'Hold and drag to reorder',
    rateTitle: 'Daily rate',
    rateBody: 'How much each day moves your scores, up or down.',
    rateNames: { '0.01': 'Steady', '0.02': 'Ambitious', '0.03': 'Relentless' } as Record<
      string,
      string
    >,
    ratePerfect: (mult: string, days: number) => `${mult} in ${days} perfect days`,
    ratePenalty: (pct: string) => `A missed day costs the same ${pct}`,
    rateCap: '3% is the cap. Beyond that, compounding stops meaning anything.',
    durationTitle: 'Duration',
    durationBody: 'Rest days count toward the duration.',
    durationEnds: (date: string) => `Ends ${date}`,
    durationCustom: 'Custom',
    restTitle: 'Rest days',
    restBody: 'Rest days pause both graphs. Pick up to two, or none.',
    restMax: 'Two rest days is the limit.',
    restNone: 'No rest days',
    sleepTitle: 'Sleep time',
    sleepBody:
      "You can only tick within the 2 hours before sleep. The server's clock decides, not your phone's.",
    sleepWindow: (open: string, close: string) => `Check-in: ${open} ${EN_DASH} ${close}`,
    sleepEveryDay: 'every day',
    sleepChange: 'Change sleep time',
    reviewTitle: 'Review and lock',
    reviewWarning: (days: number) =>
      `Once locked, your works, rate, rest days and sleep time can't change for ${days} days. You can end early, but the plan will be marked as ended.`,
    holdToLock: 'Hold to lock',
    holding: 'Keep holding',
    locked: 'Plan locked',
    startsToday: 'Your plan starts today',
    startsTomorrow: 'Your plan starts tomorrow',
    startsOn: (date: string) => `Your plan starts ${date}`,
    firstWindow: (time: string) => `First check-in opens at ${time}.`,
    notifAsk: 'Get a reminder when check-in opens and 30 minutes before it closes?',
    notifAllow: 'Turn on reminders',
    notifLater: 'Not now',
    goToToday: 'Go to Today',
    prefilled: 'Works copied from your previous plan. Edit them freely.',
    labels: {
      works: 'Works',
      rate: 'Rate',
      duration: 'Duration',
      rest: 'Rest days',
      sleep: 'Sleep time',
      window: 'Check-in window',
      timezone: 'Time zone',
      dates: 'Dates',
    },
  },

  today: {
    dayOf: (i: number, n: number) => `Day ${i} of ${n}`,
    pillBefore: (time: string, inText: string) => `Check-in opens ${time} ${DOT} in ${inText}`,
    pillOpen: (inText: string) => `Check-in open ${DOT} closes in ${inText}`,
    pillComplete: (i: number) => `Day ${i} complete`,
    pillClosed: (i: number, done: number, total: number) =>
      `Day ${i} closed ${DOT} ${done} of ${total}`,
    pillRest: `Rest day ${DOT} graphs paused`,
    pillNotStartedTomorrow: (time: string) =>
      `Your plan starts tomorrow ${DOT} first check-in ${time}`,
    pillNotStartedOn: (date: string, time: string) =>
      `Your plan starts ${date} ${DOT} first check-in ${time}`,
    consistency: 'Consistency',
    perfectPath: (score: string, gap: string) => `Perfect path ${score} ${DOT} gap ${gap}`,
    stakesAll: (n: number, score: string) => `All ${n} done ${UP} ${score}`,
    stakesAny: (score: string) => `Any missed ${DOWN} ${score}`,
    stakesIfAll: 'If all done',
    stakesIfMissed: 'If any missed',
    worksHeader: 'Works',
    dayComplete: 'Day complete',
    dayCompleteBody: 'Every work done. The score moves up when the window closes.',
    progressOf: (done: number, total: number) => `${done} of ${total} done`,
    lockedToast: (when: string) => `Check-in opens ${when}`,
    lockedRest: 'Rest day. Nothing to tick today.',
    lockedEnded: 'This plan has ended.',
    planFinished: 'Plan complete',
    planFinishedBody: 'See how the whole plan went.',
    seeResults: 'See results',
    noPlanTitle: 'Create your plan',
    noPlanBody:
      'Pick the works you will do every day and a daily rate. The plan locks for 30 to 90 days.',
    noPlanCta: 'Create your plan',
    settings: 'Settings',
    restBody: 'Nothing to tick today. Both graphs are paused.',
  },

  progress: {
    title: 'Progress',
    overall: 'Overall',
    eachWork: 'Each work',
    stats: {
      current: 'Current score',
      perfect: 'Perfect path',
      gap: 'Gap',
      completion: 'Completion rate',
      streak: 'Current streak',
      best: 'Best streak',
    },
    daysCount: (done: number, total: number) => `${done}/${total} days`,
    sinceStart: 'since start',
    heatmap: 'Calendar',
    legend: {
      complete: 'Complete',
      partial: 'Partial',
      missed: 'Missed',
      rest: 'Rest',
      future: 'Upcoming',
    },
    tooltip: (day: number, date: string) => `Day ${day} ${DOT} ${date}`,
    status: {
      complete: 'Complete',
      partial: 'Partial',
      missed: 'Missed',
      rest: 'Rest',
      start: 'Start',
      open: 'Open',
      pending: 'Today',
      upcoming: 'Upcoming',
    } as Record<string, string>,
    chartA11y: (days: number, start: string, end: string, perfect: string) =>
      `Consistency over ${days} closed days: from ${start} to ${end}. Perfect path is ${perfect}.`,
    chartA11yEmpty: 'No closed days yet. The chart starts after your first check-in window closes.',
    workChartA11y: (parts: string) => `Per-work scores: ${parts}.`,
    noData: 'The graph starts after your first window closes.',
    noPlan: 'No plan yet. Your graphs will appear here.',
  },

  history: {
    title: 'History',
    empty: 'Finished plans are kept here forever.',
    completed: 'Completed',
    endedEarly: 'Ended early',
    active: 'Active',
    finalVsPerfect: (a: string, b: string) => `${a} vs perfect ${b}`,
    completion: (p: string) => `${p} complete`,
    startNew: 'Start a new plan',
    startNewFrom: 'Start a new plan with these works',
  },

  plan: {
    detailsTitle: 'Plan details',
    lockedNote: 'Locked. These settings cannot change.',
    dangerZone: 'Danger zone',
    endEarly: 'End plan early',
    endEarlyBody:
      'Ending early stops scoring at this moment. Days that have already closed keep their results. The plan is kept in History, marked as ended early. This cannot be undone.',
    endEarlyPrompt: 'Type END to confirm',
    endEarlyConfirm: 'End plan',
    endedToast: 'Plan ended. It is kept in History.',
  },

  results: {
    title: 'Results',
    finalScore: 'Final score',
    vsPerfect: (p: string) => `Perfect path ${p}`,
    completion: 'Completion rate',
    bestStreak: 'Best streak',
    ranking: 'Works, ranked',
    startNext: 'Start next plan',
    summary: (complete: number, active: number, best: string | null, worst: string | null) => {
      const base = `You completed ${complete} of ${active} active days.`;
      if (best && worst && best !== worst)
        return `${base} ${best} carried you; ${worst} held you back.`;
      if (best) return `${base} ${best} was your most consistent work.`;
      return base;
    },
    summaryNone: 'No active days closed in this plan.',
  },

  settings: {
    title: 'Settings',
    account: 'Account',
    name: 'Name',
    email: 'Email',
    signOut: 'Sign out',
    appearance: 'Appearance',
    system: 'System',
    dark: 'Dark',
    light: 'Light',
    notifications: 'Notifications',
    notifOpen: 'When check-in opens',
    notifLast: '30 minutes left',
    notifDenied: 'Notifications are off for this app in system settings.',
    openSystemSettings: 'Open settings',
    data: 'Your data',
    exportJson: 'Export as JSON',
    exportCsv: 'Export as CSV',
    howScoring: 'How scoring works',
    planDetails: 'Plan details',
    legal: 'Legal',
    privacy: 'Privacy Policy',
    terms: 'Terms',
    deleteAccount: 'Delete account',
    deleteTitle: 'Delete your account?',
    deleteBody:
      'This permanently deletes your account, every plan and every check-in. It cannot be undone.',
    deleteStep2: 'Type DELETE to confirm',
    deleteConfirm: 'Delete account',
    deleted: 'Your account has been deleted.',
    version: (v: string) => `Version ${v}`,
    devGallery: 'Component gallery (dev)',
    notSet: 'Not set',
  },

  scoring: {
    title: 'How scoring works',
    sections: [
      {
        h: 'Everything starts at 100',
        p: 'Your day score and every work score begin at 100 on day one.',
      },
      {
        h: 'Each work has its own score',
        p: 'When a check-in window closes, every work you ticked is multiplied by (1 + rate). Every work you skipped is multiplied by (1 − rate). At 2%, a done work goes from 100 to 102; a skipped one goes to 98.',
      },
      {
        h: 'The day score is all or nothing',
        p: 'Your day score rises by the rate only if every work was done. If any work is skipped, it falls by the same rate. Three of four done is a down day.',
      },
      {
        h: 'Rest days pause everything',
        p: 'On a rest day nothing moves: not the day score, not the work scores, not the perfect path. Rest days still count toward the plan length.',
      },
      {
        h: 'The perfect path',
        p: 'The dashed line is where you would be if every active day were complete: 100 × (1 + rate) for each closed day. The gap is how far your score sits below it.',
      },
      {
        h: 'Why it compounds',
        p: 'Each day multiplies the previous result, so steady days build on each other and missed days cost more over time. Losing 2% and then gaining 2% does not bring you back to where you were.',
      },
      {
        h: 'Time is the server’s',
        p: 'Ticks count only inside the 2 hours before your sleep time, measured by the server’s clock. A day with no ticks when the window closes counts as missed.',
      },
    ],
  },

  errors: {
    generic: 'Something went wrong. Try again.',
    network: "Can't reach the server. Check your connection and try again.",
    server: 'The server had a problem. Try again in a minute.',
    WINDOW_CLOSED: 'The check-in window is closed.',
    WINDOW_CLOSED_NEXT: (when: string) => `The check-in window is closed. It opens ${when}.`,
    OUTSIDE_PLAN: 'Your plan has not started yet.',
    REST_DAY: 'Today is a rest day. Nothing to tick.',
    PLAN_NOT_ACTIVE: 'This plan has ended.',
    ACTIVE_PLAN_EXISTS: 'You already have an active plan.',
    WORK_NOT_FOUND: "That work isn't in your current plan.",
    PLAN_NOT_FOUND: "That plan wasn't found.",
    CONFIRMATION_REQUIRED: 'Type END exactly to confirm.',
    INVALID_RATE: 'Choose a rate of 1%, 2% or 3%.',
    INVALID_DURATION: 'Duration must be between 30 and 90 days.',
    INVALID_REST_DAYS: 'Choose at most two different rest days.',
    INVALID_SLEEP_TIME: 'Sleep time must be between 8:00 PM and 4:00 AM.',
    INVALID_TIMEZONE: "Your phone's time zone isn't recognised.",
    INVALID_WORKS: 'Add between one and eight works.',
    INVALID_WORK_TITLE: 'Each work needs a title of 1 to 40 characters.',
    INVALID_DONE_CRITERIA: 'Keep "what counts as done" under 120 characters.',
    NOT_AUTHENTICATED: 'Your session has expired. Sign in again.',
    loadFailed: "Couldn't load your plan.",
    offlineTick: "You're offline. Ticks need a connection.",
  },

  a11y: {
    settingsButton: 'Settings',
    checkbox: (title: string) => `${title}`,
    checkboxLockedHint: 'Locked until the check-in window opens',
    scoreHero: (s: string, d: string) => `Consistency score ${s}, last change ${d}`,
    delta: (sign: 'up' | 'down' | 'flat', value: string) =>
      sign === 'flat'
        ? `No change`
        : `${sign === 'up' ? 'Up' : 'Down'} ${value.replace(MINUS, '')}`,
    holdToConfirm: 'Press and hold for one and a half seconds',
    heatmapCell: (day: number, date: string, status: string) => `Day ${day}, ${date}, ${status}`,
  },
} as const;

export type Copy = typeof en;
export const t = en;
