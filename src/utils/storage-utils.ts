/**
 * @param text Some text (for ex a URL)
 * @returns A filesystem compatible name
 */
export function filenamize(text: string): string {
  return text.replace(/[/\\?%*:|"<>]/g, '-');
}

/**
 * Mkdir -p
 * @param directories the chain of directories to create
 * @returns the handle to the last created subdirectory
 */
export async function getOrCreateDirectoryChain(
  directories: string | string[],
): Promise<FileSystemDirectoryHandle> {
  let handle = await navigator.storage.getDirectory();
  if (typeof directories === 'string') {
    directories = [directories];
  }
  for (const dirName of directories) {
    handle = await handle.getDirectoryHandle(dirName, {create: true});
  }

  return handle;
}

/**
 * Stream To a file.
 * @param directory Directory handle
 * @param filename Name of the file to write to
 * @param stream A readable stream
 * @returns
 */
export async function streamToFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  stream: ReadableStream<Uint8Array>,
): Promise<void> {
  // FIXME: check the filename?
  const fileHandle = await directory.getFileHandle(name, {
    create: true,
  });
  const writable = await fileHandle.createWritable({
    keepExistingData: false,
  });
  return stream.pipeTo(writable);
}
