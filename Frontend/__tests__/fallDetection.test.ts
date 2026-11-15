import {
  buildSimulatedFallWaveform,
  FallDetectorEngine,
} from '../src/services/fallDetection';
import { FallDetectionStage } from '../src/types/FallEvent';

describe('5-Stage FallDetectorEngine', () => {
  test('detects a genuine 5-stage fall (normal -> free_fall -> impact -> confirmation -> alert)', () => {
    const stages: FallDetectionStage[] = [];
    let detected: any = null;

    const engine = new FallDetectorEngine('Medium', {
      onStageChange: (stage) => stages.push(stage),
      onFallDetected: (result) => {
        detected = result;
      },
    });

    const samples = buildSimulatedFallWaveform(100000);
    for (const s of samples) {
      engine.processSample(s);
    }

    expect(stages).toEqual(['free_fall', 'impact', 'confirmation', 'alert']);
    expect(detected).not.toBeNull();
    expect(detected.impactForce).toBeGreaterThanOrEqual(2.8);
    expect(detected.confidence).toBeGreaterThanOrEqual(0.78);
    expect(detected.sensorData.stagesCompleted).toEqual([
      'normal',
      'free_fall',
      'impact',
      'confirmation',
      'alert',
    ]);
  });

  test('ignores normal movement or sudden spike without prior free fall', () => {
    let triggered = false;
    const engine = new FallDetectorEngine('Medium', {
      onFallDetected: () => {
        triggered = true;
      },
    });

    let t = 50000;
    // Normal walking + sudden spike without free fall
    for (let i = 0; i < 15; i++) {
      engine.processSample({
        ax: i === 5 ? 25 : 0.3,
        ay: i === 5 ? 20 : 0.4,
        az: i === 5 ? 25 : 9.8,
        gx: 0.2,
        gy: 0.2,
        gz: 0.1,
        hasGyroscope: true,
        timestamp: t,
      });
      t += 20;
    }

    expect(triggered).toBe(false);
    expect(engine.getStage()).toBe('normal');
  });

  test('cancels alert if user picks up phone / walks immediately after impact', () => {
    const stages: FallDetectionStage[] = [];
    let triggered = false;

    const engine = new FallDetectorEngine('Medium', {
      onStageChange: (stage) => stages.push(stage),
      onFallDetected: () => {
        triggered = true;
      },
    });

    const samples = buildSimulatedFallWaveform(200000);
    // Replace the stillness tail (last 100 samples) with active walking / pickup motion
    const activeStart = samples.length - 100;
    for (let i = activeStart; i < samples.length; i++) {
      samples[i] = {
        ...samples[i],
        ax: 8.5,
        ay: 10.5,
        az: 14.0,
        gx: 3.1,
        gy: 2.0,
        gz: 1.4,
      };
    }

    for (const s of samples) {
      engine.processSample(s);
    }

    expect(triggered).toBe(false);
    expect(stages).toContain('free_fall');
    expect(stages).toContain('impact');
    expect(stages).toContain('confirmation');
    expect(stages[stages.length - 1]).toBe('normal');
  });
});
