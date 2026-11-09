import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('recording_health',Path(__file__).parents[1]/'deploy'/'recording_health.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def health():
 h={k:{'enabled':True,'dropped':{},'lastError':None} for k in ('recorder','tradeTape','chartHistory','exposure','recordedCashHistory')}
 h['recorder'].update(startedAt='a',recorded={'NQ':10},pendingBytes={'NQ':0},maxPendingBytes=100)
 h['templateCounts']={'150':10};return h
class Tests(unittest.TestCase):
 def test_cash_writer_has_no_enabled_flag(self):
  h=health();h['recordedCashHistory']={'source':'VPS recorded live quotes','written':10,'lastError':None};self.assertEqual(m.summarize_recording_health(h)['warnings'],[])
 def test_healthy_and_closed_market_idle(self):
  h=health();a=m.summarize_recording_health(h);self.assertEqual(a['warnings'],[]);self.assertEqual(m.summarize_recording_health(h,a)['warnings'],[])
 def test_disabled(self):
  h=health();h['tradeTape']['enabled']=False;self.assertIn('RECORDING_DISABLED: tradeTape',m.summarize_recording_health(h)['warnings'])
 def test_dropped_and_write_error(self):
  h=health();h['exposure'].update(dropped={'map':2},lastError='disk full');self.assertEqual(len(m.summarize_recording_health(h)['warnings']),2)
 def test_stalled_only_after_two_observations_and_market_advance(self):
  h=health();a=m.summarize_recording_health(h);h['templateCounts']['150']=11;b=m.summarize_recording_health(h,a);self.assertEqual(b['warnings'],[]);h['templateCounts']['150']=12;c=m.summarize_recording_health(h,b);self.assertEqual(len(c['warnings']),1)
 def test_restart_counters_reset(self):
  h=health();a=m.summarize_recording_health(h);a['stalledIntervals']=5;h['recorder']['startedAt']='b';self.assertEqual(m.summarize_recording_health(h,a)['warnings'],[])
 def test_backpressure(self):
  h=health();h['recorder']['pendingBytes']['NQ']=80;self.assertIn('RECORDING_BACKPRESSURE: raw writer nearing buffer limit',m.summarize_recording_health(h)['warnings'])
if __name__=='__main__':unittest.main()
