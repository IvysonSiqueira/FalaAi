const {test}=require('node:test');const assert=require('node:assert/strict');
const {fixtureScope}=require('./helpers/lgpd-fixtures.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
test('manifesto bloqueia conta preexistente e caminho alheio',()=>{const s=fixtureScope();assert.throws(()=>s.requireUser(A));s.addUser(A);s.addUser(B);const p=A+'/'+B+'.png';s.addPath(A,p);assert.equal(s.requirePath(A,p),p);assert.throws(()=>s.requirePath(B,p));assert.throws(()=>s.addPath(B,p));});
test('manifesto aceita somente UUIDs canônicos e impede repetição ambígua',()=>{const s=fixtureScope();assert.throws(()=>s.addUser('other'));s.addUser(A);assert.throws(()=>s.addPath(A,A+'/../x.png'));assert.throws(()=>s.addPath(A,A+'/x.png'));assert.throws(()=>s.addUser(A));});
test('manifesto persiste IDs sem aceitar credenciais',()=>{const history=[];const s=fixtureScope(v=>history.push(JSON.stringify(v)));s.addUser(A);s.addPath(A,A+'/'+B+'.png');assert.equal(history.length,2);assert.deepEqual(Object.keys(JSON.parse(history[1])[0]).sort(),['id','paths']);});
