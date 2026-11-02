import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { c, lift } from '../../lib/theme';
import { WorkflowStep, workflowFor } from '../../shared/innerCircle';
import { Card } from '../ui';
import { Progress } from './kit';
import { Txt } from './Txt';

// One row of the brief tracker: a dot on a rail, the step, and whose move it is.
export function StepRow({ step, last }: { step: WorkflowStep; last: boolean }) {
  const color = step.state === 'done' ? c.ok : step.state === 'blocked' ? c.bad : step.state === 'current' ? c.orange : c.line;
  const live = step.state === 'current' || step.state === 'blocked';
  return (
    <View style={s.step}>
      <View style={s.rail}>
        <View style={[s.dot, { backgroundColor: step.state === 'todo' ? c.raised : color, borderColor: color }, live && lift]}>
          {step.state === 'done' ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
          {step.state === 'blocked' ? <Ionicons name="pause" size={11} color="#fff" /> : null}
        </View>
        {!last ? <View style={[s.line, { backgroundColor: step.state === 'done' ? c.ok : c.line }]} /> : null}
      </View>
      <View style={[s.stepBody, step.state === 'todo' && { opacity: 0.55 }, last && { paddingBottom: 0 }]}>
        <View style={s.between}>
          <Txt v="body" style={{ flex: 1, fontWeight: live ? '700' : '600', color: c.inkStrong, fontSize: 14.5 }}>{step.title}</Txt>
          {live ? (
            <View style={[s.owner, { backgroundColor: step.owner === 'you' ? c.orangeSoft : c.violetSoft }]}>
              <Txt v="caption" style={{ color: step.owner === 'you' ? c.orangeInk : c.violet, fontWeight: '700' }}>
                {step.owner === 'you' ? 'Your move' : step.owner === 'client' ? 'With the client' : 'With us'}
              </Txt>
            </View>
          ) : null}
        </View>
        {live || step.state === 'done' ? <Txt v="small" style={{ marginTop: 3, fontSize: 13 }}>{step.detail}</Txt> : null}
      </View>
    </View>
  );
}

// The same tracker for the task screen. Paid-ness lives in payout_queue, not on the gig, so the
// last step needs one extra read.
export function BriefProgress({ gig, workerId }: { gig: any; workerId: string }) {
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    supabase
      .from('payout_queue')
      .select('gig_id, status')
      .eq('worker_id', workerId)
      .eq('gig_id', gig.id)
      .then(({ data }) => setPaid((data ?? []).some((p: any) => String(p.status).toLowerCase() === 'completed')));
  }, [gig.id, workerId]);

  const steps = workflowFor({ ...gig, paid_out: paid });
  const done = steps.filter((x) => x.state === 'done').length;
  return (
    <Card style={{ gap: 14 }}>
      <View style={s.between}>
        <Txt v="heading" style={{ fontSize: 17 }}>Where this stands</Txt>
        <Txt v="caption">{done} of {steps.length}</Txt>
      </View>
      <Progress value={done} total={steps.length} color={done === steps.length ? c.ok : c.violet} />
      <View>
        {steps.map((st, i) => (
          <StepRow key={st.key} step={st} last={i === steps.length - 1} />
        ))}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 22 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 14, marginVertical: 2, borderRadius: 1 },
  stepBody: { flex: 1, paddingBottom: 16 },
  owner: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
});
