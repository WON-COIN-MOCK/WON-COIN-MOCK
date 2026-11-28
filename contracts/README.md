# Sepolia 개발환경 검증 · 2026-11-28

## 팀원 시작 안내

먼저 #52의 V3 서명 변경이 포함된 커밋을 받는다. 아래 명령은 Windows와 macOS 모두 저장소 루트에서 실행한다.

| 역할 | 준비물 | 확인 방법 |
| --- | --- | --- |
| 로컬 개발·테스트 | 프로젝트 코드와 잠금 파일 | 아래 설치 절차 후 `pnpm ct:test`에서 테스트 3개 통과 |
| 팀 주소의 Sepolia 잔고 조회 | 각자의 Sepolia RPC URL, 체인 ID, 공개 운영 주소 | 아래 조회 절차에 따라 `pnpm ct:rpc` 실행 |
| 승인된 운영 서명 담당자 | 암호화된 V3 파일과 별도로 전달받은 비밀번호 | **파일을 먼저 배치한 뒤** `pnpm ct:account`로 주소 확인 |

전체 팀에는 이 README와 PR 링크를 공유한다. V3 파일은 승인된 서명 담당자에게만 전달한다. 기존 DPAPI 파일과 개인별 .env는 보관자가 유지한다. Mac에서 처음 설정한 팀원은 로컬 테스트 결과를 확인하고, 서명 담당자는 아래 주소와 대조한다.

## 환경 검증 결과

| 작업 | 상태 | 실제 결과 |
| --- | --- | --- |
| Solidity / Hardhat | 완료: 개발환경 범위 | Solidity 0.8.17, Hardhat 3.22.0, london 컴파일 및 로컬 테스트 3개 통과 |
| Sepolia 전용 계정 | 완료 | 생성·암호화 후 복구 및 동일 주소 재사용 검증 |
| 테스트 ETH | 완료 | 운영 주소 잔고 0.05 Sepolia ETH (50000000000000000 wei) |
| Alchemy / Infura RPC | 완료 | Alchemy chain ID 11155111, 블록 12229928에서 잔고 조회 성공 |

공개 운영 주소: `0x616e48ec4678f3070ff6b651aa1bae7edde88e16`

계정 파일의 chainId 11155111은 용도 표시이며 네트워크 검증 결과가 아니다. 아직 Owner/Agent 권한을 부여하지 않았다.

## 기존 구조와 변경 파일

pnpm workspace, Spring Boot 3개 서비스, PostgreSQL/Flyway Compose, B 모델을 유지했다. 증권만 온체인, 원화는 PostgreSQL이다. Compose에는 Besu 서비스가 없다. 로컬 .env의 기존 BESU_RPC_URL은 수정하거나 사용하지 않았다. AGENTS.md 일부에는 Besu 관련 오래된 설명이 남아 있다. 백엔드에는 Web3j 의존성이 아직 없다.

- 루트 package.json, pnpm-lock.yaml: 검증 명령·공식 의존성 추가
- contracts/package.json: 정확한 의존성 버전, 테스트·린트 명령
- contracts/hardhat.config.ts: london 유지, optimizer 200 runs, Sepolia 설정
- contracts/contracts/ReferenceImports.sol: 공식 컨트랙트·ONCHAINID 컴파일 진입점
- contracts/contracts/ReferenceSmoke.t.sol: 정상·무권한·중복 호출 검사
- scripts/sepolia-account.mjs: V3 계정·서명 CLI 진입점
- scripts/sepolia-check.mjs: 읽기 전용 Sepolia RPC 검증
- .gitignore: .secrets/ 제외
- .env.example: chain ID 11155111과 공개 운영 주소 항목
- contracts/README.md: 검증 결과와 재현 절차

DB·백엔드·Outbox·Worker 구현과 네트워크 배포, 메인넷 요청, 실제 자산 거래, 원격 push는 수행하지 않았다.

## 의존성 호환성

기존 Hardhat 3.22.0과 Solidity 0.8.17은 변경하지 않았다. npm 메타데이터 및 [공식 T-REX package.json](https://github.com/ERC-3643/ERC-3643/blob/main/package.json)을 대조해 다음 신규 의존성을 고정했다.

| 패키지 | 설치 버전 |
| --- | --- |
| @erc3643org/erc-3643 | 4.1.3 |
| @openzeppelin/contracts | 4.9.6 |
| @openzeppelin/contracts-upgradeable | 4.9.6 |
| @onchain-id/solidity | 2.0.0 |

공식 T-REX의 개발 의존성은 Hardhat ^2.14.0 / toolbox ^2.0.2이다. 이 개발 의존성은 소비자 설치 시 자동 설치되지 않는다. Hardhat 2용 플러그인·배포 스크립트를 가져오지 않고 공식 Solidity 소스를 기존 Hardhat 3에서 컴파일했다. 소스 호환성과 기본 실행은 확인했지만 upstream 전체 테스트·배포 도구 호환성을 확인한 것은 아니다.

최적화 없이 Factory·Token 크기 경고가 발생해 optimizer를 켰다. 최종 deployed bytecode는 TREXFactory 23,495 bytes, Token 14,245 bytes로 EIP-170 제한 24,576 bytes 미만이다. 공식 프록시의 payable fallback / receive 경고는 남아 있다. 라이브러리 소스는 수정하지 않았다.

## 실행 및 실제 검증

팀원은 저장소 루트에서 아래 순서로 로컬 개발을 시작한다. 컴파일과 로컬 테스트에는 Alchemy 키나 Sepolia ETH가 필요하지 않다.

```powershell
pnpm check-env
pnpm install --frozen-lockfile
pnpm ct:compile
pnpm ct:test
pnpm ct:lint
```

- check-env: Node 26.13.1, pnpm 12.21.0, Java 21, Compose 5.7.0, Gitleaks 8.30.1 통과. 제한된 실행 권한에서는 Gitleaks 접근 거부가 발생했고 정상 권한으로 재검사해 통과했다.
- compile / test: solc 0.8.17, EVM london, 테스트 3개 통과. 공식 ClaimTopicsRegistry의 정상 호출·무권한 거절·중복 거절을 검사한다.
- lint: 오류 0개, 경고 27개. 테스트의 require·저수준 호출·NatSpec 및 컴파일 진입점의 미사용 import 관련 경고다.
- account: created-and-recovery-verified 후 재실행 시 reused-and-verified.
- rpc: 미발급 상태에서 종료 코드 1, BLOCKCHAIN_RPC_URL 누락을 명확히 보고한다.
- 별도 실패 검사: 메인넷 URL, 설정 chain ID 불일치, 모의 RPC 응답 chain ID 1을 거절했다. 모의 검사는 실제 Sepolia 연결 증거가 아니다.
- Gitleaks: scripts 폴더 검사에서 유출 발견 없음. git check-ignore로 계정 파일 제외 확인. 폴더 접근 권한은 현재 Windows 사용자만 명시적으로 허용한다.

이 테스트는 ERC-3643 전체 업무 검수(Factory 종목 생성·decimals 0·KYC·동결·강제 이전)를 대신하지 않는다. Slither 및 백엔드 통합 검증은 미수행이다.

## Sepolia 운영 계정 · Windows / macOS

저장소 루트에서 `pnpm ct:account`를 실행한다. 기존 운영자는 **원래 Windows 프로필에서 처음 한 번** 새 비밀번호(12자 이상)를 터미널에 두 번 입력한다. 기존 DPAPI 파일이 있으면 동일 개인키를 Ethereum Web3 Secret Storage V3(scrypt)로 암호화해 복호화와 주소를 대조한 뒤 `.secrets/sepolia-operator.v3.json`에 저장한다. 원본은 보존한다. 변환은 오프라인이며 테스트 ETH 이동은 없다.

같은 주소로 서명할 권한이 있는 팀원은 암호화된 V3 파일을 승인된 비밀 공유 수단으로 전달받고, 비밀번호는 별도 경로로 전달받는다. 파일을 같은 경로에 놓고 로컬 .env의 BLOCKCHAIN_OPERATOR_ADDRESS에 합의한 공개 주소를 지정한 뒤 `pnpm ct:account`로 검증한다. 비밀번호를 잃으면 V3 파일만으로 복구할 수 없다. 하나의 키를 공유하면 서명만으로 개별 담당자를 구분하거나 한 사람의 권한만 회수할 수 없다. 새 독립 테스트 계정은 기존 파일과 지정 주소가 없는 환경에서 생성한다.

서명할 때는 아래 구조로 실제 요청의 수신 주소·nonce·가스·금액(wei)·data를 확인하여 unsigned.json을 작성한다. 아래 값은 형식 예시다.

```json
{"type":2,"chainId":11155111,"to":"0x0000000000000000000000000000000000000001","nonce":0,"gasLimit":"21000","maxFeePerGas":"2000000000","maxPriorityFeePerGas":"1000000000","value":"0","data":"0x"}
```

`pnpm ct:sign unsigned.json`을 실행하고 표시되는 요청을 검토한 뒤 SIGN을 입력한다. 서명 결과는 Git 제외 폴더 .secrets에 저장된다. 누구든 이 결과로 해당 거래를 제출할 수 있으므로 로그나 채팅에 공유하지 않는다. 명령은 네트워크에 거래를 전송하지 않는다. 테스트넷 전용이며 Owner/Agent 권한은 별도로 관리한다.

## 다른 환경에서 Sepolia를 조회하는 절차

1. [Alchemy Dashboard](https://dashboard.alchemy.com/)에서 Ethereum Sepolia RPC를 발급하거나 Infura Sepolia HTTPS endpoint를 발급한다.
2. 루트 `.env`에 다음 항목을 로컬 편집기로 저장한다. 실제 API 키를 채팅이나 Git에 붙여넣지 않는다.

```dotenv
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
BLOCKCHAIN_CHAIN_ID=11155111
BLOCKCHAIN_OPERATOR_ADDRESS=0x616e48ec4678f3070ff6b651aa1bae7edde88e16
```

3. 팀 운영 주소를 조회할 때는 위 공개 주소와 각자의 RPC URL만 설정한다. 계정 생성 또는 faucet 추가 수령은 필요하지 않다. 별도 테스트 계정이 필요한 담당자만 pnpm ct:account를 실행한다.
4. `pnpm ct:rpc`를 실행한다. eth_chainId가 11155111인지 확인한 뒤 eth_blockNumber·eth_getBlockByNumber·동일 블록의 eth_getBalance를 조회한다. 잔고는 정수 문자열로 계산한다. 잔고 양수면 종료 코드 0, 잔고 0이면 2, 설정/네트워크 오류는 1이다.

Hardhat Sepolia 설정은 accounts: []이며 암호화 계정을 자동 로드하거나 거래를 제출하지 않는다. 2026-11-28 21:04:32 KST에 pnpm ct:rpc가 종료 코드 0으로 완료됐다. 확인한 블록 해시는 0x4dfbc9375465752d9218dc17a6ab4e1823c1555b2cbc10c653006d68a100bf18이다.
