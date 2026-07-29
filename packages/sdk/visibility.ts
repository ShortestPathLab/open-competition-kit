/**
 * Whether a competition is public yet, re-exported on its own path.
 *
 * Same reason as `./window`: the root `index.ts` drags the whole kit in, and a
 * client component that only wants to label a draft should not pay for the
 * database and the hook system to say so.
 */
export * from "@open-competition-kit/core/config/visibility";
