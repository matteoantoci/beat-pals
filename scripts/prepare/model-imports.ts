// Lets Node load the game model. The model imports its own files without the `.ts` extension, because Vite
// resolves them. Node needs the full file name, so this hook adds `.ts` to a relative import with no extension
// in a .ts file. The packages are .js files, so their imports stay as they are.

import { registerHooks } from 'node:module';

const HAS_EXTENSION = /\.[cm]?[jt]s$/u;

const needsExtension = (specifier: string, parent: string | undefined): boolean =>
  specifier.startsWith('.') && !HAS_EXTENSION.test(specifier) && parent?.endsWith('.ts') === true;

/** Call this before the first import of the game model. */
export const allowModelImports = (): void => {
  registerHooks({
    resolve: (specifier, context, nextResolve) =>
      nextResolve(needsExtension(specifier, context.parentURL) ? `${specifier}.ts` : specifier, context),
  });
};
