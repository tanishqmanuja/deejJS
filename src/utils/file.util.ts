import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

export const readYAML = (filepath: string) => {
  try {
    const buff = readFileSync(filepath, 'utf-8');
    return parse(buff);
  } catch (error) {
    return undefined;
  }
};

export const writeYAML = (filepath: string, data: unknown) => {
  try {
    writeFileSync(filepath, stringify(data));
  } catch {
    console.log(`Error writing ${filepath}`);
  }
};
