/* eslint-disable */
/**
 * This is function is just for debugging.
 * @param directoryHandle directory handle
 * @param depth Depth
 */
export async function listDirectoryContents(
  directoryHandle: FileSystemDirectoryHandle,
  depth: number,
): Promise<void> {
  // From https://shaneosullivan.wordpress.com/2023/11/28/how-to-list-all-files-in-a-browsers-origin-private-file-system/
  // @ts-expect-error this method do exist according to mdn
  const entries =
    (await directoryHandle.values()) as Promise<FileSystemDirectoryHandle>[];

  // @ts-ignore
  for await (const entry of entries) {
    // Add proper indentation based on the depth
    const indentation = '    '.repeat(depth);

    if (entry.kind === 'directory') {
      // If it's a directory, log its name
      // and recursively list its contents
      console.log(`${indentation}${entry.name}/`);
      await listDirectoryContents(entry, depth + 1);
    } else {
      // If it's a file, log its name
      console.log(`${indentation}${entry.name}`);
    }
  }
}
