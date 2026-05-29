import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function PINLoginScreen() {
  const [pin, setPin] = useState('');
  const handleDigit = (d: string) => { if (pin.length < 4) setPin(pin + d); };
  return (
    <View style={s.container}>
      <Text style={s.title}>Enter PIN</Text>
      <View style={s.dots}>
        {[0,1,2,3].map(i => <View key={i} style={[s.dot, pin.length > i && s.dotFilled]} />)}
      </View>
      <View style={s.keypad}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k,i) => (
          <TouchableOpacity key={i} style={s.key} onPress={() => k === '⌫' ? setPin(pin.slice(0,-1)) : k && handleDigit(k)}>
            <Text style={s.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#FAFAF8' },
  title:{ fontSize:22, marginBottom:32 },
  dots:{ flexDirection:'row', gap:16, marginBottom:40 },
  dot:{ width:16, height:16, borderRadius:8, borderWidth:1.5, borderColor:'#CCCAC4' },
  dotFilled:{ backgroundColor:'#B85C2C', borderColor:'#B85C2C' },
  keypad:{ flexDirection:'row', flexWrap:'wrap', width:240, gap:12 },
  key:{ width:64, height:64, borderRadius:32, borderWidth:1, borderColor:'#E2E0DA', alignItems:'center', justifyContent:'center', backgroundColor:'#fff' },
  keyText:{ fontSize:22, color:'#0A0A0A' },
});
