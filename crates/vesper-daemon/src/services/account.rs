use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use vesper_core::ident::AccountId;
use vesper_core::account::Account;

pub struct AccountService {
    accounts: Arc<RwLock<HashMap<String, Account>>>,
}

impl AccountService {
    pub fn new() -> Self {
        Self {
            accounts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn list_accounts(&self) -> Vec<Account> {
        let accounts = self.accounts.read().await;
        accounts.values().cloned().collect()
    }

    pub async fn add_account(&self, account: Account) {
        let mut accounts = self.accounts.write().await;
        accounts.insert(account.id.to_string(), account);
    }

    pub async fn remove_account(&self, id: &AccountId) -> Option<Account> {
        let mut accounts = self.accounts.write().await;
        accounts.remove(&id.to_string())
    }

    pub async fn get_account(&self, id: &AccountId) -> Option<Account> {
        let accounts = self.accounts.read().await;
        accounts.get(&id.to_string()).cloned()
    }
}