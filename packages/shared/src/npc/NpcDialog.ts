import type { NpcBehaviorState, QuestMeta } from "./NpcBehavior.js";

export interface NpcDialogConfig {
  dialogChance: number; // 0-1, rolled when NPC pauses
  lines: string[];      // random ambient lines (DEFAULT state)
  userLines?: string[]; // lines when a player talks to them (DEFAULT responses)
  behaviors?: Record<string, NpcBehaviorState>;  // generic state map
  quest?: QuestMeta;    // quest log metadata (if this NPC has a quest)
}

export const NPC_DIALOG: Record<string, NpcDialogConfig> = {
  guard: {
    dialogChance: 0.25,
    lines: [
      "All quiet on the watch.",
      "Move along, citizen.",
      "Stay out of trouble.",
      "I've got my eye on you.",
      "Nothing to report.",
    ],
    userLines: [
      "The roads have been safe lately.",
      "Keep your wits about you out there.",
      "Nothing suspicious to report... yet.",
    ],
  },
  gate_guard: {
    dialogChance: 0.3,
    lines: [
      "Halt! State your business.",
      "The gates remain open... for now.",
      "Keep your weapons sheathed in town.",
      "Welcome to Shireland.",
      "Safe travels, adventurer.",
    ],
    userLines: [
      "The road north leads to the wilderness.",
      "We don't get many travelers these days.",
      "Stay close to town if you value your hide.",
    ],
  },
  elder: {
    dialogChance: 0.2,
    lines: [
      "Hmm... the winds are changing.",
      "I remember when this was all fields...",
      "Wisdom comes to those who wait.",
      "The old ways still hold power.",
      "Have you spoken to the merchant?",
    ],
    userLines: [
      "Ah, young one. There is much to learn.",
      "The ancient texts speak of a power beneath the hills.",
      "Seek the merchant if you need supplies.",
    ],
  },
  merchant: {
    dialogChance: 0.3,
    lines: [
      "Fine wares for sale!",
      "Best prices in all the land!",
      "Come, take a look!",
      "Fresh stock, just arrived!",
      "You won't find better deals elsewhere.",
    ],
    userLines: [
      "Looking to buy? I've got just the thing.",
      "Trade's been slow, but I still have the best stock.",
      "Need something special? Let me see what I have.",
    ],
  },
  villager: {
    dialogChance: 0.2,
    lines: [
      "Lovely day, isn't it?",
      "Have you tried the inn's stew?",
      "I heard strange noises last night...",
      "The harvest looks good this year.",
      "Oh, hello there!",
    ],
    userLines: [
      "Welcome to our little village!",
      "Have you met the elder? Wise old fellow.",
      "Life here is simple, but good.",
    ],
  },
  captain: {
    dialogChance: 0.25,
    lines: [
      "The sea calls to me...",
      "A fair wind today.",
      "I've sailed stranger waters than these.",
      "Check the rigging, lads!",
      "*gazes toward the horizon*",
    ],
    userLines: [
      "Aye, I've captained ships across every sea.",
      "Looking for passage? My crew's resting for now.",
      "The tides wait for no one, remember that.",
    ],
  },
  captain_coder: {
    dialogChance: 0.3,
    lines: [
      "The code compiles... for now.",
      "I've debugged stranger bugs than these.",
      "A clean commit is a fair wind.",
      "*mutters about merge conflicts*",
      "Every great program starts with a single line.",
    ],
    userLines: [
      "Ahoy! They call me CaptainCoder.",
      "I've sailed the seas of syntax and lived to tell the tale.",
      "Got a quest for you, if you've got the grit...",
    ],
    quest: {
      questId: "captain_coder_intro",
      name: "The Captain's Challenge",
      description: "CaptainCoder has a task for aspiring adventurers.",
      reward: "50 Gold",
      statusMap: {
        default: "not_started",
        pre_quest: "not_started",
        mid_quest: "in_progress",
        post_quest: "completed",
      },
    },
    behaviors: {
      pre_quest: {
        scope: "player",
        responses: [
          "Ahoy! I've been looking for someone with grit...",
          "You look like you can handle a challenge. Listen up.",
          "I need a brave soul for a task. Interested?",
        ],
        onTalk: "mid_quest",
      },
      mid_quest: {
        scope: "player",
        responses: [
          "How's that quest coming along?",
          "Don't give up now, you're almost there!",
          "The best code is written under pressure.",
        ],
      },
      post_quest: {
        scope: "player",
        responses: [
          "You've done well, adventurer!",
          "A job well done. I knew you had it in you.",
          "That was some fine work. I'll remember your name.",
        ],
      },
    },
  },
  dog: {
    dialogChance: 0.4,
    lines: [
      "Woof!",
      "Arf arf!",
      "Bark!",
      "*pants happily*",
      "*wags tail*",
      "Woof woof!",
    ],
  },
};
