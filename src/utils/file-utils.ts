export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(<string>reader.result);
    };
    reader.onerror = () => {
      reject(new Error('Convert to base64 failed'));
    };
    reader.readAsDataURL(file);
  });
}
