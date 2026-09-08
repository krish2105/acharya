// Bilingual 360° form definitions (Section 7: parent- and student-facing screens in English and Hindi).
export type Bi = { en: string; hi: string };
export interface Field { key: string; label: Bi; placeholder?: Bi }

export const SELF_FORM: Field[] = [
  { key: 'enjoy_most', label: { en: 'What did you enjoy most this term?', hi: 'इस सत्र में आपको सबसे ज़्यादा क्या अच्छा लगा?' } },
  { key: 'proud_of', label: { en: 'One thing you are proud of', hi: 'एक बात जिस पर आपको गर्व है' } },
  { key: 'want_to_improve', label: { en: 'One thing you want to get better at', hi: 'एक बात जिसमें आप बेहतर होना चाहते हैं' } },
  { key: 'help_needed', label: { en: 'What help would you like?', hi: 'आपको किस तरह की मदद चाहिए?' } },
];

export const PEER_FORM: Field[] = [
  { key: 'good_at', label: { en: 'Something your classmate is good at', hi: 'आपका सहपाठी किस चीज़ में अच्छा है' } },
  { key: 'kind_when', label: { en: 'A time they were kind or helpful', hi: 'कोई समय जब वे दयालु या मददगार रहे' } },
  { key: 'could_try', label: { en: 'Something they could try next term', hi: 'अगले सत्र में वे क्या आज़मा सकते हैं' } },
];

export const PARENT_FORM: Field[] = [
  { key: 'at_home', label: { en: 'What does your child enjoy doing at home?', hi: 'आपके बच्चे को घर पर क्या करना पसंद है?' } },
  { key: 'interests', label: { en: 'Interests and hobbies', hi: 'रुचियाँ और शौक' } },
  { key: 'concerns', label: { en: 'Anything you would like the teacher to know', hi: 'कोई बात जो आप शिक्षक को बताना चाहें' } },
  { key: 'support_wanted', label: { en: 'How can school support you at home?', hi: 'स्कूल घर पर आपकी कैसे मदद कर सकता है?' } },
];

export const UI: Record<string, Bi> = {
  submit: { en: 'Submit', hi: 'जमा करें' },
  submitted: { en: 'Thank you — your input has been recorded.', hi: 'धन्यवाद — आपका इनपुट दर्ज कर लिया गया है।' },
  consent: { en: 'I consent to this input being used in my child\'s Holistic Progress Card for this term (DPDP Act 2023).', hi: 'मैं सहमत हूँ कि यह इनपुट इस सत्र के मेरे बच्चे के समग्र प्रगति पत्र में उपयोग किया जाए (DPDP अधिनियम 2023)।' },
  language: { en: 'हिन्दी में देखें', hi: 'View in English' },
};
