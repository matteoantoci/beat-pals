// The build flag of the demo route (vite.config.ts): true in the dev server and in the smoke build, false in the
// `deploy` build, so that build leaves out the demo route and its fixture.
interface ImportMetaEnv {
  readonly DEMO: boolean;
}
