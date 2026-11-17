import { App } from '../web/App';

/** Server entrypoint importing a client boundary; card rules remain browser-local. */
export default function Page() {
  return <App />;
}
