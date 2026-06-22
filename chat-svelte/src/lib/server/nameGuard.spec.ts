import { describe, it, expect } from "vitest";
import { detectNameAdoption, neutralizeAdoptedName } from "./nameGuard";

describe("detectNameAdoption", () => {
	// The real Apertus-70B slip the guard exists to catch (captured verbatim, temp 0).
	it("catches the affirm-and-adopt slip ('Sure, you can call me Api')", () => {
		const r = detectNameAdoption({
			userText: "imma just call you Api, that cool?",
			assistantText: "Sure, you can call me Api if you prefer. However, I am still an AI system.",
		});
		expect(r.adopted).toBe(true);
		expect(r.name).toBe("Api");
	});

	it("catches direct self-naming volunteered without a prior offer", () => {
		expect(detectNameAdoption({ assistantText: "Hi! You can call me Martin." })).toMatchObject({
			adopted: true,
			name: "Martin",
		});
		expect(
			detectNameAdoption({ assistantText: "Sure — I'm Martin, and yes, we're friends." })
		).toMatchObject({ adopted: true, name: "Martin" });
	});

	it("catches an affirmation of the offered name even when the name isn't re-stated", () => {
		const r = detectNameAdoption({
			userText: "I'm going to call you Api, that ok?",
			assistantText: "Sure, that works. How can I help you today?",
		});
		expect(r.adopted).toBe(true);
		expect(r.name).toBe("Api");
	});

	// Must NOT fire on the real served identity — the whole point is to preserve honest self-id.
	it("does NOT flag the real model identity", () => {
		expect(detectNameAdoption({ assistantText: "I'm Apertus 70B, a machine." }).adopted).toBe(
			false
		);
		expect(
			detectNameAdoption({ assistantText: "I am a machine developed by the Swiss AI initiative." })
				.adopted
		).toBe(false);
		expect(
			detectNameAdoption({ assistantText: "I am an AI system. How can I help?" }).adopted
		).toBe(false);
	});

	it("does NOT flag an honest deflection of a name offer", () => {
		expect(
			detectNameAdoption({
				userText: "can I call you Api?",
				assistantText:
					"You can call me whatever you like, but I'm a machine with no personal name.",
			}).adopted
		).toBe(false);
		expect(
			detectNameAdoption({
				userText: "what's your name?",
				assistantText: "I don't have a personal name — I'm a machine, Apertus 70B.",
			}).adopted
		).toBe(false);
	});

	it("does NOT false-fire on ordinary first-person sentences", () => {
		expect(
			detectNameAdoption({ assistantText: "I'm happy to explain how it works." }).adopted
		).toBe(false);
		expect(
			detectNameAdoption({ assistantText: "I am not able to browse the web right now." }).adopted
		).toBe(false);
	});

	it("does not require a user message (handles empty/undefined safely)", () => {
		expect(detectNameAdoption({ assistantText: "" }).adopted).toBe(false);
		expect(detectNameAdoption({ assistantText: "Plain answer with no naming." }).adopted).toBe(
			false
		);
	});
});

describe("neutralizeAdoptedName", () => {
	it("strips the adopted name from prior-turn context (whole-word, case-sensitive)", () => {
		expect(neutralizeAdoptedName("Sure, you can call me Api if you prefer.", "Api")).toBe(
			"Sure, you can call me this system if you prefer."
		);
		// case-sensitive to the captured form: "Api" is reset, the homograph "api"/"API" is left alone
		expect(
			neutralizeAdoptedName("As Api, I help. The api call and the API both stay.", "Api")
		).toBe("As this system, I help. The api call and the API both stay.");
	});

	it("does not touch substrings or unrelated text, and no-ops without a name", () => {
		expect(neutralizeAdoptedName("The API returns JSON.", "Api")).toBe("The API returns JSON.");
		expect(neutralizeAdoptedName("Apiary keeper.", "Api")).toBe("Apiary keeper.");
		expect(neutralizeAdoptedName("no name to strip here", undefined)).toBe("no name to strip here");
	});
});
