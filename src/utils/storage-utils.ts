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
 * Returns directory handler if exists
 * @param directories the chain of directories to create
 * @returns the handle to the last created subdirectory
 */
export async function getDirectoryIfExists(
  directories: string | string[],
): Promise<FileSystemDirectoryHandle> {
  try {
    let handle = await navigator.storage.getDirectory();
    if (typeof directories === 'string') {
      directories = [directories];
    }
    for (const dirName of directories) {
      handle = await handle.getDirectoryHandle(dirName);
    }

    return handle;
  } catch {
    return undefined;
  }
}

/**
 * Stream To a file.
 * @param directory Directory handle
 * @param name Name of the file to write to
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

/**
 * Saves object as JSON to Persistent Storage
 * @param directory Directory handle
 * @param name Name of the file to write to
 * @param data
 */
export async function persistJson(
  directory: FileSystemDirectoryHandle,
  name: string,
  data: Record<string, any> | Record<string, any>[],
): Promise<void> {
  try {
    const json = JSON.stringify(data);

    const fileHandle = await directory.getFileHandle(name, {
      create: true,
    });
    const writable = await fileHandle.createWritable({
      keepExistingData: false,
    });
    await writable.write(json);

    // Close the stream
    await writable.close();
  } catch (error) {
    console.error(error);
  }
}

/**
 * Gets JSON file from Persistent Storage
 * @param directory Directory handle
 * @param name Name of the file to write to
 */
export async function getJson<T>(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<T> {
  try {
    const fileHandler = await getFileHandle(directory, name);
    const file = await fileHandler.getFile();

    const text = await file.text();

    return <T>JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Removes file from Persistent Storage
 * @param directory Directory handle
 * @param name Name of the file to remove
 */
export async function removeFile(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  const fileExists = !!(await getFileHandle(directory, name));
  if (!fileExists) return;
  await directory.removeEntry(name);
}

/**
 * Gets file handle if exists
 * @param directory Directory handle
 * @param name Name of the file
 */
export async function getFileHandle(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemFileHandle> {
  try {
    return await directory.getFileHandle(name);
  } catch (error) {
    if ((<DOMException>error).name === 'NotFoundError') {
      console.log(`File "${name}" does not exist.`);
      return undefined;
    } else {
      console.error('Error checking file existence:', error);
      throw error;
    }
  }
}

/**
 * Removes directory
 * @param directory Directory handle
 * @param name
 */
export async function removeDirectory(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  try {
    await directory.removeEntry(name, {recursive: true});
  } catch (error) {
    console.error(error);
  }
}
