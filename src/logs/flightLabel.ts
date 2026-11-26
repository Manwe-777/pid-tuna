/** A file name with the flight number when the file holds several flights, e.g. "LOG00005.BFL #2". */
export function flightLabel(fileName: string, logIndex: number, logCount: number): string {
  return logCount > 1 ? `${fileName} #${logIndex + 1}` : fileName;
}
