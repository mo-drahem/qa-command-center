import { Toaster } from 'react-hot-toast';
import LoggerView from './components/LoggerView';

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <LoggerView />
    </>
  );
}
