import { BF_MOTOR_PROTOCOLS } from '../constants';

/** The name of a `motor_pwm_protocol` header value; undefined when absent or unknown. */
export function motorProtocolName(raw: number | null): string | undefined {
  return raw === null ? undefined : BF_MOTOR_PROTOCOLS[raw];
}
