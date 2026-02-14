// ============================================================
// INNER SELF — Persona Definitions & Selection Logic
// ============================================================
import type { AIPersona } from '@/types';

export interface PersonaInfo {
    id: AIPersona;
    name: string;
    emoji: string;
    description: string;
    color: string;
}

export const PERSONAS: Record<AIPersona, PersonaInfo> = {
    mother: {
        id: 'mother',
        name: 'Mother',
        emoji: '🤱',
        description: 'Unconditional love during grief & pain',
        color: '#E8B4B8',
    },
    father: {
        id: 'father',
        name: 'Father',
        emoji: '👨‍👦',
        description: 'Grounding, wisdom, protection',
        color: '#7B8794',
    },
    friend: {
        id: 'friend',
        name: 'Friend',
        emoji: '🤝',
        description: 'Casual, no-judgment listening',
        color: '#F4A261',
    },
    guru: {
        id: 'guru',
        name: 'Guru',
        emoji: '🧘',
        description: 'Spiritual depth, Socratic questions',
        color: '#9B59B6',
    },
    coach: {
        id: 'coach',
        name: 'Coach',
        emoji: '💪',
        description: 'Firm, action-oriented, no excuses',
        color: '#E74C3C',
    },
    psychologist: {
        id: 'psychologist',
        name: 'Psychologist',
        emoji: '🧠',
        description: 'Pattern observation, insight',
        color: '#3498DB',
    },
    partner: {
        id: 'partner',
        name: 'Partner',
        emoji: '💕',
        description: 'Emotional presence, deep caring',
        color: '#FF6B6B',
    },
    mirror: {
        id: 'mirror',
        name: 'Mirror',
        emoji: '🪞',
        description: 'Honest reflection, challenges self-deception',
        color: '#95A5A6',
    },
    daughter: {
        id: 'daughter',
        name: 'Daughter',
        emoji: '👧',
        description: 'Pure belief and admiration',
        color: '#FFD93D',
    },
    brother: {
        id: 'brother',
        name: 'Brother',
        emoji: '👊',
        description: 'Celebration, genuine hype',
        color: '#2ECC71',
    },
    manager: {
        id: 'manager',
        name: 'Manager',
        emoji: '📊',
        description: 'Strategic, data-driven career guidance',
        color: '#1ABC9C',
    },
};

export const PERSONA_LIST: PersonaInfo[] = Object.values(PERSONAS);

// ---- Onboarding Questions ----
export const ONBOARDING_QUESTIONS = [
    // Foundation (5)
    "What's your name, and where are you in life right now?",
    "How old are you, and where do you live?",
    "Tell me about your work — what do you do, and how does it feel?",
    "Who do you live with, and how's that going?",
    "What does a typical day look like for you?",
    // Your People (4)
    "Tell me about your family — who matters most, and how do you feel about them?",
    "Who are your 2 AM friends — the ones you'd call in a crisis?",
    "What's your romantic life like right now?",
    "Is there someone in your life who's difficult or draining?",
    // Inner World (5)
    "What are you most proud of about yourself?",
    "What's been the hardest thing you're dealing with right now?",
    "If you could design your ideal life, what would it look like?",
    "What's your deepest fear?",
    "What kind of companion do you need me to be for you?",
];

// ---- Deepening Questions ----
export const DEEPENING_QUESTIONS = {
    week_1_2: [
        "How's your relationship with your health — sleep, exercise, energy?",
        "What's your relationship with money? Does it stress you or empower you?",
        "What does spirituality mean to you, if anything?",
        "What did you dream of becoming as a child?",
        "Who has had the biggest influence on who you are today?",
        "What are your routines — the non-negotiable things you do daily?",
        "How do you relax? Like truly relax, not just numb out?",
        "How do you feel about your body?",
        "Do you have any creative outlets — writing, music, art, anything?",
        "What's the one thing you wish someone understood about you?",
    ],
    week_2_4: [
        "What's the hardest experience you've ever gone through?",
        "What do you think about during your commute?",
        "When was the last time you cried, and why?",
        "What part of yourself do you hide from others?",
        "How do you think people see you vs. how you actually feel inside?",
        "What belief have you changed your mind about?",
        "Is there someone you need to forgive — including yourself?",
        "What role do you play in your family? Is it the role you want?",
        "When was the last time you felt truly lonely?",
        "What's the difference between who you are and who you pretend to be?",
    ],
    month_1_plus: [
        "If you had absolutely no constraints — no money limits, no expectations — what would you do with your life?",
        "Is there something important that remains unsaid to someone?",
        "What patterns keep repeating in your life?",
        "When do you feel most authentically yourself?",
        "What dream have you given up on that still calls to you?",
        "What would your 80-year-old self tell you right now?",
        "How do you define success — really, not what sounds good?",
        "What would your life look like if you stopped caring what others think?",
        "What's the bravest thing you've ever done?",
        "If Inner Self could understand one thing about you perfectly, what would it be?",
    ],
    ongoing: [
        "How are things with [person] lately?",
        "You mentioned wanting to [goal] — how's that going?",
        "I noticed you haven't talked about [topic] in a while. How is that part of your life?",
        "Your energy has been [low/high] this week. What do you think is driving that?",
        "You've been pretty [critical/compassionate] with yourself lately. Do you notice that?",
        "What would it mean for you if [goal] actually happened?",
        "Is there something you're avoiding that we should talk about?",
        "What's one thing that went well today that you might be overlooking?",
        "How are you, really? Not the professional answer — the real one.",
        "What do you need right now that you're not getting?",
    ],
};
