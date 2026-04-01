function renderCharts(etfResults, totalDivAnnual) {
  const colors = ['#4299e1','#68d391','#f6ad55','#fc8181','#9f7aea','#76e4f7','#fbb6ce','#c6f6d5','#fed7d7','#bee3f8','#fefcbf','#e9d8fd'];
  const tickers = etfResults.map(r => r.ticker);

  charts.alloc = new Chart(document.getElementById('allocChart').getContext('2d'), {
    type:'doughnut',
    data:{ labels:tickers, datasets:[{ data:etfResults.map(r=>r.weight), backgroundColor:colors.slice(0,tickers.length), borderColor:'#1a1f2e', borderWidth:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#a0aec0', font:{size:11}, boxWidth:12 } }, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw}%` } } } }
  });

  charts.yield = new Chart(document.getElementById('yieldChart').getContext('2d'), {
    type:'bar',
    data:{ labels:tickers, datasets:[{ label:'Annual Yield %', data:etfResults.map(r=>(r.annualDivYield*100).toFixed(2)), backgroundColor:etfResults.map(r=>r.annualDivYield>0.5?'#fc8181':r.annualDivYield>0.15?'#f6ad55':'#68d391'), borderRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#718096'},grid:{color:'rgba(0,0,0,.07)'}}, y:{ticks:{color:'#718096',callback:v=>v+'%'},grid:{color:'rgba(0,0,0,.07)'}} } }
  });

  charts.return = new Chart(document.getElementById('returnChart').getContext('2d'), {
    type:'bar',
    data:{ labels:tickers, datasets:[
      { label:'1Y Price Return', data:etfResults.map(r=>(r.oneYReturn*100).toFixed(2)), backgroundColor:etfResults.map(r=>r.oneYReturn>=0?'rgba(104,211,145,.7)':'rgba(252,129,129,.7)'), borderRadius:4 },
      { label:'1Y Total Return', data:etfResults.map(r=>(r.totalReturn1Y*100).toFixed(2)), backgroundColor:etfResults.map(r=>r.totalReturn1Y>=0?'rgba(66,153,225,.7)':'rgba(252,129,129,.4)'), borderRadius:4 }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:'#4a5568',font:{size:11}}}}, scales:{ x:{ticks:{color:'#718096'},grid:{color:'rgba(0,0,0,.07)'}}, y:{ticks:{color:'#718096',callback:v=>v+'%'},grid:{color:'rgba(0,0,0,.07)'}} } }
  });

  const months = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb'];
  charts.income = new Chart(document.getElementById('incomeChart').getContext('2d'), {
    type:'bar',
    data:{ labels:months, datasets:[{ label:'Monthly Income', data:months.map(()=>(totalDivAnnual/12).toFixed(2)), backgroundColor:'rgba(104,211,145,.6)', borderColor:'#68d391', borderWidth:1, borderRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#718096'},grid:{color:'rgba(0,0,0,.07)'}}, y:{ticks:{color:'#718096',callback:v=>'$'+Number(v).toLocaleString()},grid:{color:'rgba(0,0,0,.07)'}} } }
  });

  // Projection chart — year-by-year 0–15
  const startValue = etfResults.reduce((a,r) => a + r.invested, 0);
  const scenarios = [
    { label:'Bear Case', adj:0.70, borderColor:'rgba(252,129,129,.8)',  bgColor:'rgba(252,129,129,.08)' },
    { label:'Base Case', adj:1.00, borderColor:'rgba(99,179,237,.95)',  bgColor:'rgba(99,179,237,.12)'  },
    { label:'Bull Case', adj:1.30, borderColor:'rgba(104,211,145,.9)',  bgColor:'rgba(104,211,145,.10)' },
  ];
  const projLabels = Array.from({length:16}, (_,i) => i === 0 ? 'Now' : `Yr ${i}`);
  const projDatasets = scenarios.map(s => {
    const proj = projectPortfolio(etfResults, startValue, 15, s.adj, true);
    return {
      label: s.label,
      data: proj.yearlyData.map(p => parseFloat(p.total_value.toFixed(2))),
      borderColor: s.borderColor,
      backgroundColor: s.bgColor,
      borderWidth: s.label === 'Base Case' ? 3 : 1.5,
      pointRadius: p => [0,5,10,15].includes(p.dataIndex) ? 5 : 2,
      fill: false,
      tension: 0.4,
    };
  });

  charts.proj = new Chart(document.getElementById('projChart').getContext('2d'), {
    type:'line',
    data:{ labels:projLabels, datasets:projDatasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ labels:{ color:'#a0aec0', font:{size:12}, boxWidth:16 } },
        tooltip:{
          callbacks:{
            label: ctx => ` ${ctx.dataset.label}: ${fmt$(ctx.parsed.y)}`,
            afterBody: (items) => {
              const yr = items[0].dataIndex;
              if (yr === 0) return [];
              const base = scenarios[1];
              const proj = projectPortfolio(etfResults, startValue, 15, base.adj, true);
              const inc = proj.yearlyData[yr]?.income_annual || 0;
              return [`Monthly income (base): ${fmt$(inc/12)}`];
            }
          }
        },
        annotation: {
          annotations: {
            yr5:  { type:'line', xMin:5,  xMax:5,  borderColor:'rgba(0,0,0,.1)', borderDash:[4,4] },
            yr10: { type:'line', xMin:10, xMax:10, borderColor:'rgba(0,0,0,.1)', borderDash:[4,4] },
            yr15: { type:'line', xMin:15, xMax:15, borderColor:'rgba(0,0,0,.1)', borderDash:[4,4] },
          }
        }
      },
      scales:{
        x:{ ticks:{ color:'#718096' }, grid:{ color:'rgba(0,0,0,.06)' } },
        y:{ ticks:{ color:'#718096', callback: v => '$'+Number(v).toLocaleString() }, grid:{ color:'rgba(0,0,0,.06)' } }
      }
    }
  });
}

