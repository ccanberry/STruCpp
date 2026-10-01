(* IEC 61131-3 Standard Function Blocks: Counters

   As IEC 61131-3 (2013) 6.6.3.5.4 and CODESYS: an up-counter counts while CV < PVmax, the
   largest value of its type, and a down-counter while CV > PVmin, the smallest; PV only sets
   the outputs (and LD loads it). Both counting inputs act on their RISING edge, and an up-down
   counter whose CU and CD rise in the same call does not count.

   Counting only while CV < PV, as this library first did, stops a counter called without a PV
   -- the common CODESYS idiom of a plain event counter, CU only -- at 0 for good: the counter
   never counts. *)

FUNCTION_BLOCK CTU
  VAR_INPUT
    CU : BOOL;
    R : BOOL;
    PV : INT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : INT;
  END_VAR
  VAR
    CU_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  IF R THEN
    CV := 0;
  ELSIF CU_T.Q AND (CV < INT#32767) THEN
    CV := CV + 1;
  END_IF;
  Q := (CV >= PV);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU_DINT
  VAR_INPUT
    CU : BOOL;
    R : BOOL;
    PV : DINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : DINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  IF R THEN
    CV := 0;
  ELSIF CU_T.Q AND (CV < DINT#2147483647) THEN
    CV := CV + 1;
  END_IF;
  Q := (CV >= PV);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU_LINT
  VAR_INPUT
    CU : BOOL;
    R : BOOL;
    PV : LINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : LINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  IF R THEN
    CV := 0;
  ELSIF CU_T.Q AND (CV < LINT#9223372036854775807) THEN
    CV := CV + 1;
  END_IF;
  Q := (CV >= PV);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU_UDINT
  VAR_INPUT
    CU : BOOL;
    R : BOOL;
    PV : UDINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : UDINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  IF R THEN
    CV := 0;
  ELSIF CU_T.Q AND (CV < UDINT#4294967295) THEN
    CV := CV + 1;
  END_IF;
  Q := (CV >= PV);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTU_ULINT
  VAR_INPUT
    CU : BOOL;
    R : BOOL;
    PV : ULINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : ULINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  IF R THEN
    CV := 0;
  ELSIF CU_T.Q AND (CV < ULINT#18446744073709551615) THEN
    CV := CV + 1;
  END_IF;
  Q := (CV >= PV);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD
  VAR_INPUT
    CD : BOOL;
    LD : BOOL;
    PV : INT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : INT;
  END_VAR
  VAR
    CD_T : R_TRIG;
  END_VAR
  CD_T(CLK := CD);
  IF LD THEN
    CV := PV;
  ELSIF CD_T.Q AND (CV > -32768) THEN
    CV := CV - 1;
  END_IF;
  Q := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD_DINT
  VAR_INPUT
    CD : BOOL;
    LD : BOOL;
    PV : DINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : DINT;
  END_VAR
  VAR
    CD_T : R_TRIG;
  END_VAR
  CD_T(CLK := CD);
  IF LD THEN
    CV := PV;
  ELSIF CD_T.Q AND (CV > -2147483648) THEN
    CV := CV - 1;
  END_IF;
  Q := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD_LINT
  VAR_INPUT
    CD : BOOL;
    LD : BOOL;
    PV : LINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : LINT;
  END_VAR
  VAR
    CD_T : R_TRIG;
  END_VAR
  CD_T(CLK := CD);
  IF LD THEN
    CV := PV;
  ELSIF CD_T.Q AND (CV > -LINT#9223372036854775807) THEN
    CV := CV - 1;
  END_IF;
  Q := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD_UDINT
  VAR_INPUT
    CD : BOOL;
    LD : BOOL;
    PV : UDINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : UDINT;
  END_VAR
  VAR
    CD_T : R_TRIG;
  END_VAR
  CD_T(CLK := CD);
  IF LD THEN
    CV := PV;
  ELSIF CD_T.Q AND (CV > UDINT#0) THEN
    CV := CV - 1;
  END_IF;
  Q := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTD_ULINT
  VAR_INPUT
    CD : BOOL;
    LD : BOOL;
    PV : ULINT;
  END_VAR
  VAR_OUTPUT
    Q : BOOL;
    CV : ULINT;
  END_VAR
  VAR
    CD_T : R_TRIG;
  END_VAR
  CD_T(CLK := CD);
  IF LD THEN
    CV := PV;
  ELSIF CD_T.Q AND (CV > ULINT#0) THEN
    CV := CV - 1;
  END_IF;
  Q := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD
  VAR_INPUT
    CU : BOOL;
    CD : BOOL;
    R : BOOL;
    LD : BOOL;
    PV : INT;
  END_VAR
  VAR_OUTPUT
    QU : BOOL;
    QD : BOOL;
    CV : INT;
  END_VAR
  VAR
    CU_T : R_TRIG;
    CD_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  CD_T(CLK := CD);
  IF R THEN
    CV := 0;
  ELSIF LD THEN
    CV := PV;
  ELSIF NOT (CU_T.Q AND CD_T.Q) THEN
    IF CU_T.Q AND (CV < INT#32767) THEN
      CV := CV + 1;
    ELSIF CD_T.Q AND (CV > -32768) THEN
      CV := CV - 1;
    END_IF;
  END_IF;
  QU := (CV >= PV);
  QD := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD_DINT
  VAR_INPUT
    CU : BOOL;
    CD : BOOL;
    R : BOOL;
    LD : BOOL;
    PV : DINT;
  END_VAR
  VAR_OUTPUT
    QU : BOOL;
    QD : BOOL;
    CV : DINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
    CD_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  CD_T(CLK := CD);
  IF R THEN
    CV := 0;
  ELSIF LD THEN
    CV := PV;
  ELSIF NOT (CU_T.Q AND CD_T.Q) THEN
    IF CU_T.Q AND (CV < DINT#2147483647) THEN
      CV := CV + 1;
    ELSIF CD_T.Q AND (CV > -2147483648) THEN
      CV := CV - 1;
    END_IF;
  END_IF;
  QU := (CV >= PV);
  QD := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD_LINT
  VAR_INPUT
    CU : BOOL;
    CD : BOOL;
    R : BOOL;
    LD : BOOL;
    PV : LINT;
  END_VAR
  VAR_OUTPUT
    QU : BOOL;
    QD : BOOL;
    CV : LINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
    CD_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  CD_T(CLK := CD);
  IF R THEN
    CV := 0;
  ELSIF LD THEN
    CV := PV;
  ELSIF NOT (CU_T.Q AND CD_T.Q) THEN
    IF CU_T.Q AND (CV < LINT#9223372036854775807) THEN
      CV := CV + 1;
    ELSIF CD_T.Q AND (CV > -LINT#9223372036854775807) THEN
      CV := CV - 1;
    END_IF;
  END_IF;
  QU := (CV >= PV);
  QD := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD_UDINT
  VAR_INPUT
    CU : BOOL;
    CD : BOOL;
    R : BOOL;
    LD : BOOL;
    PV : UDINT;
  END_VAR
  VAR_OUTPUT
    QU : BOOL;
    QD : BOOL;
    CV : UDINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
    CD_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  CD_T(CLK := CD);
  IF R THEN
    CV := 0;
  ELSIF LD THEN
    CV := PV;
  ELSIF NOT (CU_T.Q AND CD_T.Q) THEN
    IF CU_T.Q AND (CV < UDINT#4294967295) THEN
      CV := CV + 1;
    ELSIF CD_T.Q AND (CV > UDINT#0) THEN
      CV := CV - 1;
    END_IF;
  END_IF;
  QU := (CV >= PV);
  QD := (CV <= 0);
END_FUNCTION_BLOCK

FUNCTION_BLOCK CTUD_ULINT
  VAR_INPUT
    CU : BOOL;
    CD : BOOL;
    R : BOOL;
    LD : BOOL;
    PV : ULINT;
  END_VAR
  VAR_OUTPUT
    QU : BOOL;
    QD : BOOL;
    CV : ULINT;
  END_VAR
  VAR
    CU_T : R_TRIG;
    CD_T : R_TRIG;
  END_VAR
  CU_T(CLK := CU);
  CD_T(CLK := CD);
  IF R THEN
    CV := 0;
  ELSIF LD THEN
    CV := PV;
  ELSIF NOT (CU_T.Q AND CD_T.Q) THEN
    IF CU_T.Q AND (CV < ULINT#18446744073709551615) THEN
      CV := CV + 1;
    ELSIF CD_T.Q AND (CV > ULINT#0) THEN
      CV := CV - 1;
    END_IF;
  END_IF;
  QU := (CV >= PV);
  QD := (CV <= 0);
END_FUNCTION_BLOCK
