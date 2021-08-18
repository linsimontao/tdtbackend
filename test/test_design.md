# Test Design for Turnback Line Direction Estimation

Summary of test cases for turning back geodata direction estimation.

TL; DW
<img src="https://docs.google.com/drawings/d/e/2PACX-1vQNEMbJTivqtWgfX8hm6hqAARZR-p53FpZ5Ud5Wktc17_AAMgJ8HCB5M8JdX9HPA5dtbAI9JMzTkLFC/pub?w=960&h=720"/>

- $i$ indicates time sequences
- $d_{\alpha, i}$ last update of data point for player $\alpha$
- $d_{\alpha, i + 1}$ current update of data point for player $\alpha$


| patterns	|  on t2 track	| off t2 track	|   need judge?	|
|---	|---	|---	|---	|
|  p1	|   $d_{\alpha, i + 1}$	|  $d_{\alpha, i}$ 	|  N 	|
|  p2	|   $d_{\alpha, i}$	|   $d_{\alpha, i + 1}$	|  N 	|
|  p3	|   $d_{\alpha, i}$, $d_{\alpha, i + 1}$	|  $\emptyset$	|  Y	|


## Basic cases

|  id	|   $d_{\alpha, i + 1}$	|   $d_{\alpha, i}$	|   pattern	|   test result	|
|---	|---	|---	|---	|---	|
|   1	|   t2[0]	|   ls[335]	|   p1	|   pass	|
|   2	|   t2[10]	|   t2[0]	|   p3-a	|   pass	|
|   3	|   t2[10]	|   t2[50]	|   p3-b	|   pass	|
|   4	|   ls[470]	|  t2[10] 	|   p2	|   pass	|


## Advanced cases

|  id	|   $d_{\alpha, i + 1}$	|   $d_{\alpha, i}$	|   pattern	|   test result	|
|---	|---	|---	|---	|---	|
|   5	|   near t2[0]	|   ls[335]	|   p1	|   todo	|
|   6	|   near t2[10]	|   t2[0]	|   p3-a	|   todo	|
|   7	|   near t2[10]	|   t2[50]	|   p3-b	|   todo	|

Where, $5, 6, 7$ are defined in a fuzzy scale to $t2$. --> WIP