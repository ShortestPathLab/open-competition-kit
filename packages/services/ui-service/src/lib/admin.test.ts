import { describe, expect, test } from "bun:test";
import { decideAdminStatus } from "./admin";

const ADMINS = ["alice@uni.edu"];

describe("who reaches the dashboard", () => {
  test("a listed address that has been confirmed organises", () => {
    const status = decideAdminStatus({ email: "alice@uni.edu", emailVerified: true }, ADMINS);
    expect(status.isAdmin).toBe(true);
    expect(status.mayClaim).toBe(false);
  });

  // The whole point. Being listed used to be the entire check, so on a
  // deployment where anybody may register any address, whoever got to the
  // organiser's address first got the dashboard with it.
  test("a listed address that has not been confirmed does not organise yet", () => {
    const status = decideAdminStatus({ email: "alice@uni.edu", emailVerified: false }, ADMINS);
    expect(status.isAdmin).toBe(false);
    expect(status.mayClaim).toBe(true);
  });

  test("confirming an address that is not listed grants nothing", () => {
    const status = decideAdminStatus(
      { email: "mallory@elsewhere.net", emailVerified: true },
      ADMINS,
    );
    expect(status.isAdmin).toBe(false);
    expect(status.mayClaim).toBe(false);
  });

  test("a missing emailVerified reads as not confirmed", () => {
    expect(decideAdminStatus({ email: "alice@uni.edu" }, ADMINS).isAdmin).toBe(false);
    expect(decideAdminStatus({ email: "alice@uni.edu", emailVerified: null }, ADMINS).isAdmin).toBe(
      false,
    );
  });

  test("nobody signed in", () => {
    const status = decideAdminStatus(null, ADMINS);
    expect(status.signedIn).toBe(false);
    expect(status.isAdmin).toBe(false);
    expect(status.mayClaim).toBe(false);
  });

  test("an empty admins list fails closed and says why", () => {
    const status = decideAdminStatus({ email: "alice@uni.edu", emailVerified: true }, []);
    expect(status.configured).toBe(false);
    expect(status.isAdmin).toBe(false);
  });

  test("the address is matched without regard to case or surrounding space", () => {
    const status = decideAdminStatus({ email: "  Alice@Uni.edu  ", emailVerified: true }, ADMINS);
    expect(status.isAdmin).toBe(true);
  });

  test("an account with no address at all is nobody", () => {
    expect(decideAdminStatus({ email: null, emailVerified: true }, ADMINS).isAdmin).toBe(false);
    expect(decideAdminStatus({ email: "", emailVerified: true }, ADMINS).mayClaim).toBe(false);
  });
});
