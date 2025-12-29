import FileEditor from "./FileEditor.tsx";
import FileCommitLogs from "./FileCommitLogs.tsx";
import { useSignal } from "@preact/signals";

interface FileContainerProps {
  name: string;
}

export default function FileContainer(props: FileContainerProps) {
  const syncSignal = useSignal(0);

  return (
    <>
      <FileEditor name={props.name} sync={syncSignal} />
      <FileCommitLogs name={props.name} sync={syncSignal} />
    </>
  );
}
