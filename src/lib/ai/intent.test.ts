import { describe, expect, it } from "vitest";

import {
  EMPTY_INTENT,
  extractIntentLocal,
  isActionable,
  missingFields,
  nextQuestion,
  replayHistory,
  validateIntent,
  type ChatTurn,
} from "@/lib/ai/intent";

const user = (content: string): ChatTurn => ({ role: "user", content });

describe("extractIntentLocal — blood groups", () => {
  it("reads short and spoken forms", () => {
    expect(extractIntentLocal("Need O- blood in Bengaluru").blood_group).toBe("O-");
    expect(extractIntentLocal("I need B positive").blood_group).toBe("B+");
    expect(extractIntentLocal("arrange AB negative").blood_group).toBe("AB-");
  });

  it("never turns Bombay into O−", () => {
    const bombay = extractIntentLocal("Urgent Bombay phenotype blood needed in Chennai");
    expect(bombay.blood_group).toBe("OH");
    expect(bombay.rare_blood).toBe(true);
    expect(bombay.blood_group).not.toBe("O-");
  });

  it("flags para-Bombay as rare", () => {
    const pb = extractIntentLocal("need para-bombay blood now");
    expect(pb.blood_group).toBe("P-BOMBAY");
    expect(pb.rare_blood).toBe(true);
  });

  it("leaves the group null when the message does not name one", () => {
    expect(extractIntentLocal("I need blood in Delhi").blood_group).toBeNull();
  });
});

describe("extractIntentLocal — component, quantity, urgency, radius, place", () => {
  it("detects the component", () => {
    expect(extractIntentLocal("2 units of platelets in Pune").component).toBe("PLATELETS");
    expect(extractIntentLocal("need FFP").component).toBe("FFP");
    expect(extractIntentLocal("need packed red cells").component).toBe("PRBC");
  });

  it("detects quantity and clamps it", () => {
    expect(extractIntentLocal("need 3 units of O+ blood").quantity).toBe(3);
    expect(extractIntentLocal("need two units of O+ blood").quantity).toBe(2);
    expect(extractIntentLocal("need 999 units of O+ blood").quantity).toBe(1);
  });

  it("escalates urgency on emergency wording", () => {
    expect(extractIntentLocal("O- blood urgently in Delhi").urgency).toBe("emergency");
    expect(extractIntentLocal("need O- within 2 hours").urgency).toBe("emergency");
    expect(extractIntentLocal("O- blood within 5 hours").urgency).toBe("emergency");
    // A 48-hour window is a plan, not an emergency — the parser must not inflate it.
    expect(extractIntentLocal("O- blood within 48 hours").urgency).toBe("routine");
    expect(extractIntentLocal("O- blood within 48 hours").time_window_hours).toBe(48);
    expect(extractIntentLocal("planning ahead for O- blood").urgency).toBe("routine");
  });

  it("narrows the radius for emergencies and parses explicit radii", () => {
    expect(extractIntentLocal("urgent O- blood needed").radius_km).toBe(25);
    expect(extractIntentLocal("O- blood within 30 km of Mumbai").radius_km).toBe(30);
    // "near me" resolves client-side, so the default radius applies.
    expect(extractIntentLocal("O- blood near me").radius_km).toBe(50);
    expect(extractIntentLocal("O- blood in Kolkata").radius_km).toBe(50);
  });

  it("resolves cities and aliases to a canonical name", () => {
    expect(extractIntentLocal("O- blood in Bangalore").location.city).toBe("Bengaluru");
    expect(extractIntentLocal("O- blood in Chennai").location.city).toBe("Chennai");
  });

  it("leaves coordinates unset for 'near me'", () => {
    const near = extractIntentLocal("O- blood near me");
    expect(near.location.city).toBeNull();
    expect(near.location.latitude).toBeNull();
  });
});

describe("extractIntentLocal — intent label", () => {
  it("labels the request", () => {
    expect(extractIntentLocal("Find me O+ blood in Hyderabad").intent).toBe("find_blood");
    expect(extractIntentLocal("I want to donate blood").intent).toBe("find_donor");
    expect(extractIntentLocal("nearest blood bank").intent).toBe("find_blood_bank");
    expect(extractIntentLocal("how does this work").intent).toBe("help");
  });

  it("does not collapse 'blood donors' into a blood search", () => {
    expect(extractIntentLocal("find blood donors in Mumbai").intent).toBe("find_donor");
  });

  it("understands 'want' as a request for blood", () => {
    expect(extractIntentLocal("i want O- blood").intent).toBe("find_blood");
  });

  it("still routes 'want to donate' to donors", () => {
    expect(extractIntentLocal("i want to donate blood in Delhi").intent).toBe("find_donor");
  });

  it("handles the messy real-world message end to end", () => {
    const intent = extractIntentLocal("i want 0- blood from banglore");
    expect(intent.intent).toBe("find_blood");
    expect(intent.blood_group).toBe("O-");
    expect(intent.location.city).toBe("Bengaluru");
    expect(intent.missing).toEqual([]);
    expect(isActionable(intent)).toBe(true);
  });
});

describe("clarification loop", () => {
  it("asks for exactly one thing at a time", () => {
    const intent = extractIntentLocal("I need blood");
    expect(intent.missing).toEqual(["blood_group", "location"]);
    expect(nextQuestion(intent)).toBe("Which blood group do you need?");
  });

  it("asks for location once the group is known", () => {
    const intent = extractIntentLocal("I need O- blood");
    expect(intent.missing).toEqual(["location"]);
    expect(nextQuestion(intent)).toBe("Which city or area should I search around?");
  });

  it("asks what the user wants when nothing was said", () => {
    const intent = extractIntentLocal("hello");
    expect(intent.missing).toContain("intent");
    expect(nextQuestion(intent)).toBe("Tell me what you need — blood, a donor, or a blood bank.");
  });

  it("is actionable only when nothing is missing", () => {
    expect(isActionable(extractIntentLocal("hello"))).toBe(false);
    expect(isActionable(extractIntentLocal("Need O- blood in Bengaluru"))).toBe(true);
  });

  it("never asks for the same field twice", () => {
    const intent = extractIntentLocal("I need blood");
    const asked = new Set<string>();
    while (intent.missing.length > 0) {
      const q = nextQuestion(intent);
      expect(q).toBeTruthy();
      // Drop the answered field so the loop converges.
      intent.missing = intent.missing.slice(1);
      expect(asked.has(q as string)).toBe(false);
      asked.add(q as string);
    }
    expect(asked.size).toBe(2);
  });
});

describe("conversation memory", () => {
  it("carries the group forward when a later turn names only a city", () => {
    const history = [user("I need O+ blood")];
    const next = extractIntentLocal("in Delhi", history);
    expect(next.blood_group).toBe("O+");
    expect(next.location.city).toBe("Delhi");
    expect(next.intent).toBe("find_blood");
  });

  it("lets a new message override an earlier one", () => {
    const history = [user("I need O+ blood in Delhi")];
    const next = extractIntentLocal("actually make it B- in Pune", history);
    expect(next.blood_group).toBe("B-");
    expect(next.location.city).toBe("Pune");
  });

  it("keeps urgency across turns", () => {
    const history = [user("this is an emergency, O- blood in Delhi")];
    const next = extractIntentLocal("how far can you search", history);
    expect(next.urgency).toBe("emergency");
  });

  it("folds a whole history into one intent", () => {
    const acc = replayHistory([user("I need blood"), user("O- blood"), user("in Chennai")]);
    expect(acc.blood_group).toBe("O-");
    expect(acc.location.city).toBe("Chennai");
  });
});

describe("missingFields", () => {
  it("requires a group and a place for a search", () => {
    expect(missingFields({ ...EMPTY_INTENT, intent: "find_blood" })).toEqual([
      "blood_group",
      "location",
    ]);
  });

  it("accepts coordinates instead of a city", () => {
    const intent = {
      ...EMPTY_INTENT,
      intent: "find_blood" as const,
      blood_group: "O-" as const,
      location: { city: null, latitude: 12.9, longitude: 77.5 },
    };
    expect(missingFields(intent)).toEqual([]);
  });

  it("requires a city for donor registration", () => {
    expect(
      missingFields({
        ...EMPTY_INTENT,
        intent: "donor_registration",
        blood_group: "O-",
      }),
    ).toEqual(["city"]);
  });
});

describe("validateIntent — untrusted LLM output", () => {
  it("returns a safe default for garbage", () => {
    expect(validateIntent(null).intent).toBe("help");
    expect(validateIntent("just a string").blood_group).toBeNull();
    expect(validateIntent([]).missing).toContain("intent");
  });

  it("drops unknown intents, groups and components", () => {
    const v = validateIntent({
      intent: "launch_missiles",
      blood_group: "Z-",
      component: "UNICORN_BLOOD",
    });
    expect(v.intent).toBe("help");
    expect(v.blood_group).toBeNull();
    expect(v.component).toBeNull();
  });

  it("clamps quantity, radius and time window", () => {
    const hi = validateIntent({ quantity: 9999, radius_km: 9999, time_window_hours: 9999 });
    expect(hi.quantity).toBe(50);
    expect(hi.radius_km).toBe(300);
    expect(hi.time_window_hours).toBe(168);

    const lo = validateIntent({ quantity: -3, radius_km: -5, time_window_hours: -1 });
    expect(lo.quantity).toBe(1);
    expect(lo.radius_km).toBe(50);
    expect(lo.time_window_hours).toBeNull();
  });

  it("normalises the group it is handed", () => {
    expect(validateIntent({ blood_group: "o negative" }).blood_group).toBe("O-");
    expect(validateIntent({ blood_group: "Bombay" }).blood_group).toBe("OH");
  });

  it("forces rare_blood on for Bombay and off for ordinary groups", () => {
    expect(validateIntent({ blood_group: "OH", rare_blood: false }).rare_blood).toBe(true);
    expect(validateIntent({ blood_group: "P-BOMBAY" }).rare_blood).toBe(true);
    expect(validateIntent({ blood_group: "A+", rare_blood: true }).rare_blood).toBe(false);
  });

  it("keeps rare_blood when the message really did say Bombay", () => {
    expect(validateIntent({ blood_group: "A+", rare_blood: true, note: "bombay donor" }).rare_blood).toBe(
      true,
    );
  });

  it("sanitises coordinates", () => {
    const v = validateIntent({ location: { latitude: "nope", longitude: Infinity, city: "  Pune  " } });
    expect(v.location.latitude).toBeNull();
    expect(v.location.longitude).toBeNull();
    expect(v.location.city).toBe("Pune");
  });

  it("rejects unknown urgency", () => {
    expect(validateIntent({ urgency: "whenever" }).urgency).toBe("routine");
    expect(validateIntent({ urgency: "emergency" }).urgency).toBe("emergency");
  });

  it("accepts a well-formed intent without mangling it", () => {
    const v = validateIntent({
      intent: "find_blood",
      blood_group: "O-",
      component: "PRBC",
      quantity: 2,
      location: { city: "Bengaluru", latitude: 12.97, longitude: 77.59 },
      radius_km: 40,
      urgency: "emergency",
      rare_blood: false,
    });
    expect(v).toMatchObject({
      intent: "find_blood",
      blood_group: "O-",
      component: "PRBC",
      quantity: 2,
      location: { city: "Bengaluru", latitude: 12.97, longitude: 77.59 },
      radius_km: 40,
      urgency: "emergency",
      rare_blood: false,
    });
    expect(v.missing).toEqual([]);
  });
});
